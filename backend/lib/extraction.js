/**
 * Extracts computed styles for the product area, title, price, and ATC button.
 *
 * This function runs inside the browser via page.evaluate() and must be
 * entirely self-contained — no external references are allowed.
 */
function extractPdpInPage() {
  function getMainPdpBlock() {
    const selectors = [
      '[id^="shopify-section"][id*="main"]',
      '[id^="shopify-section"][id*="product"]',
      '[id^="shopify-section"][id*="template"]',
      "main",
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return { el, matchedSelector: sel };
    }
    return { el: null, matchedSelector: null };
  }

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
      minWidth: rect.width ? `${Math.round(rect.width)}px` : undefined,
      minHeight: rect.height ? `${Math.round(rect.height)}px` : undefined,
    };
  }

  const { el: main, matchedSelector } = getMainPdpBlock();
  if (!main) {
    return { mainBlock: null, matchedSelector: null, form: null, productArea: null, price: null, title: null, atc: null };
  }

  const cMain = window.getComputedStyle(main);
  const productArea = {
    background: cMain.backgroundColor,
    backgroundImage: cMain.backgroundImage,
    color: cMain.color,
    fontFamily: cMain.fontFamily,
    padding: cMain.padding,
    borderRadius: cMain.borderRadius,
    border: cMain.border,
    boxShadow: cMain.boxShadow,
  };

  const titleEl = main.querySelector("h1, h2, h3, h4, h5, h6");
  const priceEl = main.querySelector(
    ".price, .money, span.money, .product__info-wrapper .price, [data-product-price]"
  );
  const form = main.querySelector('form[action*="/cart/add"]');
  let atcEl = form
    ? form.querySelector("button[type='submit'], input[type='submit']")
    : null;
  if (!atcEl) atcEl = main.querySelector("button[type='submit']");

  return {
    mainBlock: true,
    matchedSelector,
    form: form ? { action: form.action, found: true } : { found: false, action: null },
    productArea,
    title: textSnap(titleEl),
    price: textSnap(priceEl),
    atc: atcSnap(atcEl),
  };
}

async function extractPdpPage(page) {
  return page.evaluate(extractPdpInPage);
}

module.exports = { extractPdpInPage, extractPdpPage };
