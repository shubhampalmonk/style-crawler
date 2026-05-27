const { GOTO_OPTS, PDP_SELECTOR } = require("./lib/constants");
const {
  sleep, normalizeShopUrl, createLogger, isBotChallenge, myshopifyFallback,
} = require("./lib/utils");
const { createBrowser, createContext } = require("./lib/browser");
const { scrollToBottom, getMidCollectionUrl, getMidProductUrl } = require("./lib/navigation");
const { extractPdpPage } = require("./lib/extraction");

// ---------------------------------------------------------------------------
// Step helpers
// ---------------------------------------------------------------------------

// Navigates to the product page. If Cloudflare blocks it, retries on the
// myshopify.com subdomain (which bypasses the custom-domain Cloudflare proxy).
async function navigateToPdp(page, pdpUrl, shopUrl, trace) {
  let resp = await page.goto(pdpUrl, GOTO_OPTS);
  let finalUrl = page.url();
  trace("pdp", pdpUrl, "| status:", resp?.status() ?? "none", "| final:", finalUrl);

  if (!(await isBotChallenge(page, resp, finalUrl))) return { finalUrl };

  trace("WARN: bot-protection on pdp, title:", await page.title().catch(() => ""));

  const fallback = myshopifyFallback(shopUrl, pdpUrl);
  if (!fallback) return { finalUrl, botBlocked: true };

  trace("retrying on myshopify.com:", fallback);
  resp = await page.goto(fallback, GOTO_OPTS);
  finalUrl = page.url();

  if (await isBotChallenge(page, resp, finalUrl)) {
    return { finalUrl, botBlocked: true, fallbackAlsoBlocked: true };
  }
  return { finalUrl };
}

// Waits for the Shopify section / cart form to appear after navigation.
async function waitForPdpContent(page, trace) {
  try {
    await page.waitForSelector(PDP_SELECTOR, { timeout: 8000 });
  } catch {
    trace("pdp selector not found | title:", await page.title().catch(() => "(error)"));
  }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Crawls a Shopify store and returns computed styles for the PDP product area,
 * title, price, and add-to-cart button.
 *
 * Flow: home → mid collection → mid product → extract styles.
 * Falls back to mid product on home directly if no collection link is found.
 */
async function runCrawler(shopUrl, opts = {}) {
  shopUrl = normalizeShopUrl(shopUrl);

  const { trace, withLogs } = createLogger();
  const browser = await createBrowser();

  try {
    const context = await createContext(browser);
    const page = await context.newPage();

    // 1. Load home page
    const homeResp = await page.goto(shopUrl, GOTO_OPTS);
    trace("home", shopUrl, "| status:", homeResp?.status() ?? "none");

    if (/google\./.test(page.url())) {
      return withLogs({
        ok: false,
        error: "Landed on Google — bot/IP guard blocked automation. Try a residential network.",
        shopUrl, pdpUrl: null, pdp: null, atc: null,
      });
    }

    await scrollToBottom(page);

    // 2. Find product URL: prefer collection → product, fall back to direct product on home
    const collectionFallbackUrl = await getMidCollectionUrl(page);
    let pdpUrl = null;

    if (collectionFallbackUrl) {
      trace("collection:", collectionFallbackUrl);
      await page.goto(collectionFallbackUrl, GOTO_OPTS);
      await scrollToBottom(page);
      pdpUrl = await getMidProductUrl(page);
      trace("pdpUrl from collection:", pdpUrl);
    } else {
      pdpUrl = await getMidProductUrl(page);
      trace("pdpUrl from home:", pdpUrl);
    }

    if (!pdpUrl) {
      return withLogs({
        ok: true,
        shopUrl, pdpUrl: null, pdp: null, atc: null,
        ...(collectionFallbackUrl ? { collectionFallbackUrl } : {}),
        note: collectionFallbackUrl
          ? "No product link found on the collection page."
          : "No product or /collections/ link found on the home page.",
      });
    }

    // 3. Load product page (with Cloudflare fallback)
    const { finalUrl, botBlocked, fallbackAlsoBlocked } =
      await navigateToPdp(page, pdpUrl, shopUrl, trace);

    if (botBlocked) {
      return withLogs({
        ok: false,
        error: fallbackAlsoBlocked
          ? "Cloudflare is blocking this server IP on both the custom domain and myshopify.com. A residential IP or proxy is required."
          : "Cloudflare is blocking this server IP. A residential IP or proxy is required.",
        botProtected: true,
        shopUrl, pdpUrl: finalUrl, pdp: null, atc: null,
        ...(collectionFallbackUrl ? { collectionFallbackUrl } : {}),
      });
    }

    await waitForPdpContent(page, trace);

    // 4. Extract styles — retry once if the main block hasn't rendered yet
    let raw = await extractPdpPage(page);
    if (!raw.mainBlock) {
      // Some themes hydrate content after the initial paint; give them 3s
      await sleep(3000);
      raw = await extractPdpPage(page);
    }

    trace("extraction:", raw.mainBlock ? `ok (${raw.matchedSelector})` : "mainBlock missing");

    if (!raw.mainBlock) {
      return withLogs({
        ok: true,
        shopUrl, pdpUrl: finalUrl, pdp: null, atc: null,
        note: "No [id^=shopify-section][id*=main] found after retry.",
        ...(collectionFallbackUrl ? { collectionFallbackUrl } : {}),
      });
    }

    return withLogs({
      ok: true,
      shopUrl,
      pdpUrl: page.url(),
      pdp: { form: raw.form, productArea: raw.productArea, price: raw.price, title: raw.title },
      atc: raw.atc ? { atcStyles: { ...raw.atc } } : { atcStyles: null },
      ...(collectionFallbackUrl ? { collectionFallbackUrl } : {}),
    });
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  const shopUrl = process.argv[2] || "manucurist-dev.myshopify.com";
  runCrawler(shopUrl).then(d => console.log(JSON.stringify(d, null, 2)));
}

module.exports = { runCrawler, extractPdpPage };
