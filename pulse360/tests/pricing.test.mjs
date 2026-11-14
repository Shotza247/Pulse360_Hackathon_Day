import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// The same file the browser loads, so these tests cover exactly what the page runs.
const require = createRequire(import.meta.url);
const pricing = require("../public/pricing.js");
const landing = readFileSync(fileURLToPath(new URL("../public/landing.html", import.meta.url)), "utf8");

const PAID_PLANS = ["Basic", "Premium"];

test("annual total is 12 monthly payments less the configured discount", () => {
  for (const plan of PAID_PLANS) {
    const expected = pricing.monthlyUsd(plan) * 12 * (1 - pricing.ANNUAL_DISCOUNT);
    assert.equal(pricing.annualUsd(plan), expected);
    assert.ok(pricing.annualUsd(plan) < pricing.monthlyUsd(plan) * 12);
  }
});

test("known values at the current 15% rule", () => {
  assert.equal(pricing.ANNUAL_DISCOUNT, 0.15);
  assert.ok(Math.abs(pricing.annualUsd("Basic") - 499.8) < 1e-9);
  assert.ok(Math.abs(pricing.annualUsd("Premium") - 1009.8) < 1e-9);
});

test("free and enterprise have no discountable price", () => {
  assert.equal(pricing.annualUsd("Free"), 0);
  assert.equal(pricing.annualUsd("Enterprise"), null);
  assert.equal(pricing.monthlyUsd("Enterprise"), null);
});

test("unknown plans are rejected rather than priced as undefined", () => {
  assert.throws(() => pricing.monthlyUsd("Platinum"), /Unknown plan/);
  assert.throws(() => pricing.annualUsd("constructor"), /Unknown plan/);
});

test("display copy is derived from the same rate as the calculation", () => {
  const pct = pricing.annualDiscountPercent();
  assert.equal(pct, Math.round(pricing.ANNUAL_DISCOUNT * 100));
  assert.equal(pricing.annualDiscountLabel(), `${pct}%`);
  assert.ok(pricing.annualBillingCopy().startsWith(`${pct}% off`));
  assert.ok(pricing.annualBillingNote().includes(`${pct}% off`));
  // Fractional rates are not rounded away: 12.5% must read as 12.5%.
  assert.equal(Math.round(0.125 * 10000) / 100, 12.5);
});

test("the module refuses a discount outside 0 to under 1", () => {
  const source = readFileSync(fileURLToPath(new URL("../public/pricing.js", import.meta.url)), "utf8");
  for (const bad of ["1", "1.5", "-0.1"]) {
    const broken = source.replace("const ANNUAL_DISCOUNT = 0.15;", `const ANNUAL_DISCOUNT = ${bad};`);
    assert.notEqual(broken, source);
    assert.throws(() => new Function("module", "globalThis", broken)({ exports: {} }, {}), /ANNUAL_DISCOUNT/);
  }
});

test("landing.html carries no hard-coded prices or discount percentage", () => {
  // Strip the pricing script reference and CSS; everything left is markup and page script.
  const body = landing.replace(/<style[\s\S]*?<\/style>/g, "");
  assert.doesNotMatch(body, /\$\s?\d/, "a literal dollar price is in the HTML");
  assert.doesNotMatch(body, /\b0\.85\b/, "the 0.85 multiplier is hard-coded");
  assert.doesNotMatch(body, /annualUsd\(\d/, "annualUsd is called with a literal price");
  assert.doesNotMatch(body, /monthlyUsd:\s*\d/, "a monthly price is a literal");
  assert.doesNotMatch(body, /money\(\s*\d/, "money() is called with a literal amount");
  assert.doesNotMatch(body, /\b15\s?%/, "the 15% discount text is typed into the page");
  assert.doesNotMatch(body, /\b\d+\s?percent\b/i, "a discount is written in words");
});

test("the price slots exist empty and are filled from pricing.js", () => {
  for (const id of ["freePrice", "basicPrice", "premiumPrice", "annualBillingCopy"]) {
    assert.match(landing, new RegExp(`id="${id}"[^>]*></`), `#${id} should start empty`);
  }
  assert.match(landing, /<script src="\/pricing\.js"><\/script>/);
  // pricing.js must load before the page script that reads window.Pulse360Pricing.
  assert.ok(landing.indexOf('src="/pricing.js"') < landing.indexOf("window.Pulse360Pricing"));
});
