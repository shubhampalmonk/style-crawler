const { chromium } = require("playwright");
const { BROWSER_ARGS, USER_AGENT, VIEWPORT, STATIC_ASSET_RE } = require("./constants");

async function createBrowser() {
  return chromium.launch({ headless: true, args: BROWSER_ARGS });
}

async function createContext(browser) {
  const context = await browser.newContext({ userAgent: USER_AGENT, viewport: VIEWPORT });

  // Some Shopify stores use IP/automation blockers that redirect if navigator.webdriver is set
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });

  await context.route(STATIC_ASSET_RE, route => route.abort());
  return context;
}

module.exports = { createBrowser, createContext };
