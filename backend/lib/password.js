async function unlockStorefrontIfNeeded(page, storefrontPassword) {
  const url = page.url();
  if (!/\/password(?:[/?#]|$)/i.test(url)) {
    return { required: false, unlocked: false, url };
  }

  const passwordInput = page.locator("input[type='password']").first();
  if ((await passwordInput.count()) === 0) {
    return { required: true, unlocked: false, url, error: "Password page detected, but no password input found." };
  }

  if (!storefrontPassword) {
    return {
      required: true, unlocked: false, url,
      error: "Storefront password page detected. Provide SHOP_STOREFRONT_PASSWORD (or SHOP_PASSWORD).",
    };
  }

  await passwordInput.fill(storefrontPassword);

  const form = passwordInput.locator("xpath=ancestor::form[1]");
  const submit = (await form.count()) > 0
    ? form.locator("button[type='submit'], input[type='submit']").first()
    : page.locator("button[type='submit'], input[type='submit']").first();

  if ((await submit.count()) === 0) {
    return { required: true, unlocked: false, url, error: "Password input found, but no submit button found." };
  }

  await submit.click({ timeout: 10_000 });

  try {
    await page.waitForFunction(
      () => !/\/password(?:[/?#]|$)/i.test(window.location.href),
      { timeout: 15_000 }
    );
  } catch {
    // continue — check URL below
  }

  const afterUrl = page.url();
  const unlocked = !/\/password(?:[/?#]|$)/i.test(afterUrl);

  if (!unlocked) {
    return { required: true, unlocked: false, url, afterUrl, error: "Password submit attempted, but still on password page." };
  }

  return { required: true, unlocked: true, url, afterUrl };
}

module.exports = { unlockStorefrontIfNeeded };
