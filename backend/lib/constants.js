const GOTO_OPTS = { waitUntil: "domcontentloaded", timeout: 20_000 };

const BROWSER_ARGS = [
  "--disable-blink-features=AutomationControlled",
  "--disable-dev-shm-usage", // prevents crashes on low-RAM servers where /dev/shm is tiny
  "--no-sandbox",
  "--disable-setuid-sandbox",
];

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const VIEWPORT = { width: 1280, height: 800 };

// Block static assets not needed for style extraction — saves ~60% memory per page
const STATIC_ASSET_RE =
  /\.(png|jpe?g|gif|webp|svg|ico|woff2?|ttf|eot|otf|mp4|mp3|avi|mov|wmv)(\?.*)?$/i;

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
  PDP_SELECTOR,
  BOT_CHALLENGE_RE,
};
