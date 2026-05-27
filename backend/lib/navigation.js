const { sleep } = require("./utils");

// Scroll to the bottom so lazy-loaded product/collection links are in the DOM.
async function scrollToBottom(page) {
  await page.evaluate(() => {
    window.scrollTo(0, document.body?.scrollHeight || document.documentElement?.scrollHeight || 0);
  });
  await sleep(200);
}

// Returns the middle /collections/ href on the current page, or null.
async function getMidCollectionUrl(page) {
  return page.evaluate(() => {
    const hrefs = [...new Set(
      Array.from(document.querySelectorAll('a[href*="/collections/"]'))
        .map(a => a.href)
        .filter(h => !h.includes("/products/"))
    )];
    return hrefs.length ? hrefs[Math.floor(hrefs.length / 2)] : null;
  });
}

// Returns the middle /products/ href on the current page, or null.
async function getMidProductUrl(page) {
  return page.evaluate(() => {
    const hrefs = [...new Set(
      Array.from(document.querySelectorAll('a[href*="/products/"]')).map(a => a.href)
    )];
    return hrefs.length ? hrefs[Math.floor(hrefs.length / 2)] : null;
  });
}

module.exports = { scrollToBottom, getMidCollectionUrl, getMidProductUrl };
