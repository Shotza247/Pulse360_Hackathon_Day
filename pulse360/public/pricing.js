/**
 * Single source of truth for Pulse360 public pricing.
 *
 * landing.html loads this as a classic script (window.Pulse360Pricing) and renders every
 * price and every discount sentence from it. tests/pricing.test.mjs loads the same file in
 * Node, so the page and the tests cannot drift apart. Prices are in USD; the page converts
 * for display. To change the annual discount or a plan price, edit only this file.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Pulse360Pricing = api;
})(globalThis, function () {
  // Annual billing is the total of 12 monthly payments minus this fraction (0.15 = 15% off).
  const ANNUAL_DISCOUNT = 0.15;
  const MONTHS_PER_YEAR = 12;

  // Monthly USD price per plan. null means "contact us" (no self-serve price).
  const MONTHLY_USD = Object.freeze({ Free: 0, Basic: 49, Premium: 99, Enterprise: null });

  if (!(ANNUAL_DISCOUNT >= 0 && ANNUAL_DISCOUNT < 1)) {
    throw new Error("ANNUAL_DISCOUNT must be a fraction from 0 up to (not including) 1");
  }

  function monthlyUsd(plan) {
    if (!Object.prototype.hasOwnProperty.call(MONTHLY_USD, plan)) {
      throw new Error("Unknown plan: " + plan);
    }
    return MONTHLY_USD[plan];
  }

  // 12 monthly payments less the annual discount. null for plans without a price.
  function annualUsd(plan) {
    const monthly = monthlyUsd(plan);
    return monthly === null ? null : monthly * MONTHS_PER_YEAR * (1 - ANNUAL_DISCOUNT);
  }

  // 0.15 -> 15, 0.125 -> 12.5
  function annualDiscountPercent() {
    return Math.round(ANNUAL_DISCOUNT * 10000) / 100;
  }

  function annualDiscountLabel() {
    return annualDiscountPercent() + "%";
  }

  // Sentence for the Annual button in the sign-up dialog.
  function annualBillingCopy() {
    return annualDiscountLabel() + " off the total of " + MONTHS_PER_YEAR + " monthly payments";
  }

  // Sentence appended to the pricing region note.
  function annualBillingNote() {
    return "annual billing is " + annualDiscountLabel() + " off";
  }

  return Object.freeze({
    ANNUAL_DISCOUNT,
    MONTHS_PER_YEAR,
    monthlyUsd,
    annualUsd,
    annualDiscountPercent,
    annualDiscountLabel,
    annualBillingCopy,
    annualBillingNote,
  });
});
