const { BOT_CHALLENGE_RE } = require("./constants");

const sleep = ms => new Promise(r => setTimeout(r, ms));

const memMB = () =>
  `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`;

function normalizeShopUrl(shopUrl) {
  if (!shopUrl || !String(shopUrl).trim()) throw new Error("Missing shopUrl");
  let candidate = String(shopUrl).trim();
  if (!/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(candidate)) {
    candidate = `https://${candidate}`;
  }
  const url = new URL(candidate);
  if (!url.hostname) throw new Error(`Invalid shopUrl: ${shopUrl}`);
  return url.toString();
}

function createLogger() {
  const logs = [];
  const trace = (...args) => {
    const line = args
      .map(a => (typeof a === "string" ? a : JSON.stringify(a)))
      .join(" ");
    logs.push(line);
    console.log(...args);
  };
  const withLogs = payload => ({ ...payload, logs: [...logs] });
  return { trace, withLogs };
}

function checkBotPage(title, snippet = "") {
  if (BOT_CHALLENGE_RE.test(`${title} ${snippet}`)) {
    return `bot-protection challenge detected (title: "${title}")`;
  }
  return null;
}

async function isBotChallenge(page, resp, currentUrl) {
  if (resp?.status() === 403) return true;
  if (/[?&]__cf_chl/.test(currentUrl)) return true;
  const title = await page.title().catch(() => "");
  return /just a moment|checking your browser|ddos-guard/i.test(title);
}

// If shopUrl is myshopify.com but the product landed on a custom domain,
// build a fallback on myshopify.com — Shopify's own domain bypasses Cloudflare.
function myshopifyFallback(shopUrl, targetUrl) {
  try {
    const shopHost = new URL(shopUrl).hostname;
    if (!shopHost.endsWith(".myshopify.com")) return null;
    const targetPath = new URL(targetUrl).pathname;
    const fallback = `https://${shopHost}${targetPath}`;
    return fallback === targetUrl ? null : fallback;
  } catch {
    return null;
  }
}

module.exports = {
  sleep,
  memMB,
  normalizeShopUrl,
  createLogger,
  checkBotPage,
  isBotChallenge,
  myshopifyFallback,
};
