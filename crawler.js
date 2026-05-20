const { chromium } = require("playwright");

const sleep = ms => new Promise(r => setTimeout(r, ms));
/** `load` often never fires within 60s on heavy storefronts (tags, images, third-party scripts). `domcontentloaded` is enough to read links from the DOM. */
const gotoOpts = { waitUntil: "domcontentloaded", timeout: 90_000 };

/** Some Shopify stores use “Blockify”-style IP/automation blockers that redirect to google.com if `navigator.webdriver` is set. */
async function attachCrawlerEvasion(context) {
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });
}

/**
 * In DOM order: first same-site /products/… or /collections/… (listing, not a combined path).
 * Product wins if it appears before a collection; otherwise the first of either type drives the next step.
 */
async function firstProductOrCollectionInOrder(page) {
  return page.evaluate(() => {
    const origin = window.location.origin;
    const pageHost = new URL(origin).hostname;
    const norm = h => h.replace(/^www\./, "").toLowerCase();
    const isOurSite = u => norm(u.hostname) === norm(pageHost);
    const roots = [];
    const seenRoots = new Set();
    const seenUrls = new Set();
    const addRoot = el => {
      if (!el || seenRoots.has(el)) return;
      seenRoots.add(el);
      roots.push(el);
    };
    for (const el of document.querySelectorAll('[id*="main" i], [class*="main" i], main')) {
      addRoot(el);
    }

    const scanAnchors = anchors => {
      for (const a of anchors) {
        const raw = a.getAttribute("href");
        if (!raw || raw === "#" || raw.startsWith("javascript:") || raw.startsWith("mailto:") || raw.startsWith("tel:")) {
          continue;
        }
        let u;
        try {
          u = new URL(raw, origin);
        } catch (e) {
          continue;
        }
        if (!isOurSite(u)) continue;
        const key = u.href;
        if (seenUrls.has(key)) continue;
        seenUrls.add(key);
        if (u.pathname.includes("/products/")) {
          return { kind: "product", href: u.href };
        }
        if (u.pathname.includes("/collections/") && !u.pathname.includes("/products/")) {
          return { kind: "collection", href: u.href };
        }
      }
      return null;
    };

    for (const root of roots) {
      const found = scanAnchors(root.querySelectorAll("a[href]"));
      if (found) return found;
    }

    // Fallback to old behaviour: full-document anchor scan in DOM order.
    return scanAnchors(document.querySelectorAll("a[href]"));
  });
}

/** First same-site link to a product on the current page (e.g. on a collection PLP). */
async function firstProductUrlOnPage(page) {
  return page.evaluate(() => {
    const origin = window.location.origin;
    const pageHost = new URL(origin).hostname;
    const norm = h => h.replace(/^www\./, "").toLowerCase();
    const isOurSite = u => norm(u.hostname) === norm(pageHost);
    const roots = [];
    const seenRoots = new Set();
    const seenUrls = new Set();
    const addRoot = el => {
      if (!el || seenRoots.has(el)) return;
      seenRoots.add(el);
      roots.push(el);
    };
    for (const el of document.querySelectorAll('[id*="main" i], [class*="main" i], main')) {
      addRoot(el);
    }

    const scanForProduct = anchors => {
      for (const a of anchors) {
        const raw = a.getAttribute("href");
        if (!raw || raw === "#" || raw.startsWith("javascript:") || raw.startsWith("mailto:") || raw.startsWith("tel:")) {
          continue;
        }
        let u;
        try {
          u = new URL(raw, origin);
        } catch (e) {
          continue;
        }
        if (!isOurSite(u)) continue;
        const key = u.href;
        if (seenUrls.has(key)) continue;
        seenUrls.add(key);
        if (u.pathname.includes("/products/")) return u.href;
      }
      return null;
    };

    for (const root of roots) {
      const found = scanForProduct(root.querySelectorAll("a[href]"));
      if (found) return found;
    }

    // Fallback to old behaviour: full-document anchor scan in DOM order.
    return scanForProduct(document.querySelectorAll("a[href]"));
  });
}

function extractPdpInPage() {
  function textSnap(el) {
    if (!el) return null;
    const c = window.getComputedStyle(el);
    return {
      text: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 200),
      color: c.color,
      background: c.backgroundColor,
      backgroundImage: c.backgroundImage,
      fontFamily: c.fontFamily,
      fontSize: c.fontSize,
      fontStyle: c.fontStyle,
      fontWeight: c.fontWeight,
      lineHeight: c.lineHeight,
      letterSpacing: c.letterSpacing,
      textAlign: c.textAlign,
      textTransform: c.textTransform,
      textDecoration: c.textDecoration,
      margin: c.margin,
      padding: c.padding,
    };
  }

  function getMainPdpBlock() {
    const main = document.querySelector(
      '[id^="shopify-section"][id*="main"]'
    );
    if (main) return main;
    return document.querySelector(
      '[id^="shopify-section"][id*="product"]'
    );
  }

  function atcSnap(el) {
    if (!el) return null;
    const s = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return {
      text: (el.innerText || el.value || "").trim(),
      disabled: !!el.disabled || el.getAttribute("aria-disabled") === "true",
      color: s.color,
      background: s.backgroundColor,
      fontFamily: s.fontFamily,
      fontSize: s.fontSize,
      fontStyle: s.fontStyle,
      fontWeight: s.fontWeight,
      lineHeight: s.lineHeight,
      letterSpacing: s.letterSpacing,
      textTransform: s.textTransform,
      textDecoration: s.textDecoration,
      padding: s.padding,
      margin: s.margin,
      border: s.border,
      borderRadius: s.borderRadius,
      boxShadow: s.boxShadow,
      outline: s.outline,
      minWidth: rect.width ? Math.round(rect.width) + "px" : undefined,
      minHeight: rect.height ? Math.round(rect.height) + "px" : undefined,
    };
  }

  const main = getMainPdpBlock();
  if (!main) {
    return {
      mainBlock: null,
      form: null,
      productArea: null,
      price: null,
      title: null,
      atc: null,
    };
  }

  const cMain = window.getComputedStyle(main);
  const productAreaStyle = {
    background: cMain.backgroundColor,
    backgroundImage: cMain.backgroundImage,
    color: cMain.color,
    fontFamily: cMain.fontFamily,
    padding: cMain.padding,
    borderRadius: cMain.borderRadius,
    border: cMain.border,
    boxShadow: cMain.boxShadow,
  };

  const titleEl = main.querySelector("h1");
  const title = titleEl ? textSnap(titleEl) : null;

  const priceEl = main.querySelector(
    ".price, .money, span.money, .product__info-wrapper .price, [data-product-price]"
  );
  const price = priceEl ? textSnap(priceEl) : null;

  const form = main.querySelector('form[action*="/cart/add"]');
  let atcEl = form
    ? form.querySelector("button[type='submit'], input[type='submit']")
    : null;
  if (!atcEl) {
    atcEl = main.querySelector("button[type='submit']");
  }
  const atc = atcEl ? atcSnap(atcEl) : null;

  return {
    mainBlock: true,
    form: form
      ? { action: form.action, found: true }
      : { found: false, action: null },
    productArea: productAreaStyle,
    price,
    title,
    atc,
  };
}

async function extractPdpPage(page) {
  return page.evaluate(extractPdpInPage);
}

async function unlockStorefrontIfNeeded(page, storefrontPassword) {
  const url = page.url();
  if (!/\/password(?:[/?#]|$)/i.test(url)) {
    return { required: false, unlocked: false, url };
  }

  const passwordInput = page.locator("input[type='password']").first();
  if ((await passwordInput.count()) === 0) {
    return {
      required: true,
      unlocked: false,
      url,
      error: "Password page detected, but no password input found.",
    };
  }

  if (!storefrontPassword) {
    return {
      required: true,
      unlocked: false,
      url,
      error:
        "Storefront password page detected. Provide SHOP_STOREFRONT_PASSWORD (or SHOP_PASSWORD).",
    };
  }

  await passwordInput.fill(storefrontPassword);

  const form = passwordInput.locator("xpath=ancestor::form[1]");
  let submit = null;
  if ((await form.count()) > 0) {
    submit = form
      .locator("button[type='submit'], input[type='submit']")
      .first();
  } else {
    submit = page
      .locator("button[type='submit'], input[type='submit']")
      .first();
  }

  if ((await submit.count()) === 0) {
    return {
      required: true,
      unlocked: false,
      url,
      error: "Password input found, but no submit button found.",
    };
  }

  await submit.click({ timeout: 10_000 });

  try {
    await page.waitForFunction(
      () => !/\/password(?:[/?#]|$)/i.test(window.location.href),
      { timeout: 15_000 }
    );
  } catch (e) {
    // no-op: we still report current URL below
  }

  const afterUrl = page.url();
  const unlocked = !/\/password(?:[/?#]|$)/i.test(afterUrl);
  if (!unlocked) {
    return {
      required: true,
      unlocked: false,
      url,
      afterUrl,
      error: "Password submit attempted, but still on password page.",
    };
  }

  return { required: true, unlocked: true, url, afterUrl };
}

async function runCrawler(shopUrl, opts = {}) {
  const storefrontPassword =
    opts.storefrontPassword ||
    process.env.SHOP_STOREFRONT_PASSWORD ||
    process.env.SHOP_PASSWORD;

  /** Collect crawl traces for API/UI; Playwright still logs to the server terminal only. */
  const logs = [];
  const trace = (...args) => {
    const line = args
      .map(a => (typeof a === "string" ? a : JSON.stringify(a)))
      .join(" ");
    logs.push(line);
    console.log(...args);
  };
  const withLogs = payload => ({ ...payload, logs: [...logs] });

  const browser = await chromium.launch({
    headless: false,
    args: ["--disable-blink-features=AutomationControlled"],
  });

  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 800 },
    });
    await attachCrawlerEvasion(context);

    const page = await context.newPage();
    await page.goto(shopUrl, gotoOpts);
    // const passwordGate = await unlockStorefrontIfNeeded(
    //   page,
    //   storefrontPassword
    // );
    // if (passwordGate.error) {
    //   return {
    //     ok: false,
    //     error: passwordGate.error,
    //     shopUrl: shopUrl,
    //     pdpUrl: null,
    //     pdp: null,
    //     atc: null,
    //     passwordGate,
    //   };
    // }
    const landed = page.url();
    if (/google\./.test(landed)) {
      return withLogs({
        ok: false,
        error: "Landed on Google — this store’s bot/IP guard blocked automation. If this persists, try a residential network or a non-headless run with a normal Chrome profile.",
        shopUrl: shopUrl,
        pdpUrl: null,
        pdp: null,
        atc: null,
        landedOn: landed,
      });
    }
    /*
      Why scroll: a lot of shop themes only load or wire up content when it’s in (or near) the viewport. The first screen might be hero, promos, and nav, while product or collection links sit further down. If you never scroll, those nodes may not exist yet, or you only see the top of the DOM and miss the first useful /products/ or /collections/ link the crawler looks for.

      What this line does: jump to document.body.scrollHeight (bottom of the page) so lazy sections can render, then sleep(200) gives the page a moment to finish any follow-up requests or DOM updates.

      It’s a cheap “wake the page up” step for discovery; it’s not required for every site, but it helps on long homepages and lazy-loaded layouts.

    */
    await page.evaluate(() => {
      const h =
        document.body?.scrollHeight ||
        document.documentElement?.scrollHeight ||
        0;
      window.scrollTo(0, h);
    });
    await sleep(200);

    const first = await firstProductOrCollectionInOrder(page);
    let pdpUrl = null;
    let collectionFallbackUrl = null;
    trace("first", first);

    if (first) {
      if (first.kind === "product") {
        trace("product", first);
        pdpUrl = first.href;
      } else {
        trace("collection", first);
        collectionFallbackUrl = first.href;
        trace("collectionFallbackUrl", collectionFallbackUrl);
        await page.goto(collectionFallbackUrl, gotoOpts);
        await page.evaluate(() => {
          const h =
            document.body?.scrollHeight ||
            document.documentElement?.scrollHeight ||
            0;
          window.scrollTo(0, h);
        });
        await sleep(200);
        pdpUrl = await firstProductUrlOnPage(page);
        trace("pdpUrl", pdpUrl);
      }
    }

    if (!pdpUrl) {
      return withLogs({
        ok: true,
        shopUrl: shopUrl,
        pdpUrl: null,
        pdp: null,
        atc: null,
        collectionFallbackUrl,
        note: collectionFallbackUrl
          ? "No product link on home or on the collection page we opened."
          : "No product or /collections/ link on the first page.",
      });
    }
    await page.goto(pdpUrl, gotoOpts);
    const raw = await extractPdpPage(page);
    if (!raw.mainBlock) {
      return withLogs({
        ok: true,
        shopUrl: shopUrl,
        pdpUrl: page.url(),
        pdp: null,
        atc: null,
        note: "No [id^=shopify-section][id*=main] found.",
        ...(collectionFallbackUrl ? { collectionFallbackUrl } : {}),
      });
    }

    const pdp = {
      form: raw.form,
      productArea: raw.productArea,
      price: raw.price,
      title: raw.title,
    };
    const atc = raw.atc
      ? { atcStyles: { ...raw.atc } }
      : { atcStyles: null };

    return withLogs({
      ok: true,
      shopUrl: shopUrl,
      pdpUrl: page.url(),
      pdp,
      atc,
      ...(collectionFallbackUrl ? { collectionFallbackUrl } : {}),
    });
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  const u = process.argv[2] || "https://lafeemaraboutee.fr";
  const storefrontPassword = process.argv[3] || process.env.SHOP_STOREFRONT_PASSWORD || process.env.SHOP_PASSWORD;
  runCrawler(u, { storefrontPassword }).then(d => console.log(JSON.stringify(d, null, 2)));
}

module.exports = { runCrawler, extractPdpPage };
