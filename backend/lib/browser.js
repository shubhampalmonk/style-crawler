const { chromium } = require("playwright");
const { BROWSER_ARGS, USER_AGENT, VIEWPORT, STATIC_ASSET_RE, BLOCKED_HOSTS_RE } = require("./constants");

let _browser = null;

async function getBrowser() {
  if (!_browser || !_browser.isConnected()) {
    _browser = await chromium.launch({ headless: true, args: BROWSER_ARGS });
  }
  return _browser;
}

async function createContext() {
  const browser = await getBrowser();
  const context = await browser.newContext({ userAgent: USER_AGENT, viewport: VIEWPORT });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });

  await context.route(STATIC_ASSET_RE, route => route.abort());
  await context.route(BLOCKED_HOSTS_RE, route => route.abort());

  return context;
}

module.exports = { getBrowser, createContext };
