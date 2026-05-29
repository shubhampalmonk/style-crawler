const GOTO_OPTS = { waitUntil: "domcontentloaded", timeout: 20_000 };

const BROWSER_ARGS = [
  "--disable-blink-features=AutomationControlled",
  "--disable-dev-shm-usage",
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-extensions",
  "--disable-background-networking",
  "--disable-default-apps",
  "--disable-sync",
  "--no-first-run",
];

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const VIEWPORT = { width: 1280, height: 800 };

// Block static assets not needed for style extraction — saves ~60% memory per page
const STATIC_ASSET_RE =
  /\.(png|jpe?g|gif|webp|svg|ico|woff2?|ttf|eot|otf|mp4|mp3|avi|mov|wmv)(\?.*)?$/i;

// Third-party analytics/tracking scripts — safe to block, don't affect DOM or styles
const BLOCKED_HOSTS_RE =
  /googletagmanager\.com|google-analytics\.com|connect\.facebook\.net|static\.hotjar\.com|cdn\.heapanalytics\.com|api\.segment\.io|cdn\.segment\.com|sc\.omtrdc\.net|bat\.bing\.com|px\.ads\.linkedin\.com|snap\.licdn\.com/i;

const PDP_SELECTOR =
  '[id^="shopify-section"], form[action*="/cart/add"], main, [data-product-id]';

const BOT_CHALLENGE_RE =
  /just a moment|checking your browser|enable javascript|ddos-guard|cloudflare ray/i;

module.exports = {
  GOTO_OPTS,
  BROWSER_ARGS,
  USER_AGENT,
  VIEWPORT,
  STATIC_ASSET_RE,
  BLOCKED_HOSTS_RE,
  PDP_SELECTOR,
  BOT_CHALLENGE_RE,
};
