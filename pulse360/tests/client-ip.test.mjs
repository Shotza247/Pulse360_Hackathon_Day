import test from "node:test";
import assert from "node:assert/strict";
import { getClientIp, getTrustedProxyHops } from "../src/lib/client-ip.ts";
import { createRateLimiter } from "../src/lib/rate-limit.ts";

const headers = (value) => new Headers(value === undefined ? {} : { "x-forwarded-for": value });

test("uses the entry appended by our proxy, not the first one", () => {
  assert.equal(getClientIp(headers("203.0.113.7")), "203.0.113.7");
  // The client forged the leading entries; the proxy appended the real address last.
  assert.equal(getClientIp(headers("1.1.1.1, 2.2.2.2, 203.0.113.7")), "203.0.113.7");
});

test("a forged leading entry cannot choose the visitor identity", () => {
  const a = getClientIp(headers("9.9.9.1, 203.0.113.7"));
  const b = getClientIp(headers("9.9.9.2, 203.0.113.7"));
  assert.equal(a, b);
});

test("honours extra trusted proxy hops", () => {
  assert.equal(getClientIp(headers("198.51.100.4, 203.0.113.7"), 2), "198.51.100.4");
  assert.equal(getClientIp(headers("203.0.113.7"), 2), null);
});

test("accepts IPv6", () => {
  assert.equal(getClientIp(headers("2001:db8::1")), "2001:db8::1");
});

test("returns null when missing or not an IP", () => {
  assert.equal(getClientIp(headers()), null);
  assert.equal(getClientIp(headers("")), null);
  assert.equal(getClientIp(headers("not-an-ip")), null);
  assert.equal(getClientIp(headers("203.0.113.7:8080")), null);
});

test("TRUSTED_PROXY_HOPS parsing falls back to 1", () => {
  assert.equal(getTrustedProxyHops({}), 1);
  assert.equal(getTrustedProxyHops({ TRUSTED_PROXY_HOPS: "2" }), 2);
  assert.equal(getTrustedProxyHops({ TRUSTED_PROXY_HOPS: "0" }), 1);
  assert.equal(getTrustedProxyHops({ TRUSTED_PROXY_HOPS: "abc" }), 1);
});

const limiter = () => createRateLimiter({ perKeyLimit: 3, globalLimit: 5, windowMs: 60_000 });

test("limits each key independently", () => {
  const l = limiter();
  for (let i = 0; i < 3; i++) assert.equal(l.check("a", 1_000).allowed, true);
  const denied = l.check("a", 1_000);
  assert.equal(denied.allowed, false);
  assert.equal(denied.retryAfterSeconds, 60);
  assert.equal(l.check("b", 1_000).allowed, true);
});

test("global limit caps total requests across rotating keys", () => {
  const l = limiter();
  for (let i = 0; i < 5; i++) assert.equal(l.check(`ip-${i}`, 1_000).allowed, true);
  assert.equal(l.check("ip-new", 1_000).allowed, false);
});

test("window resets and reports remaining time", () => {
  const l = limiter();
  for (let i = 0; i < 3; i++) l.check("a", 1_000);
  const denied = l.check("a", 31_000);
  assert.equal(denied.allowed, false);
  assert.equal(denied.retryAfterSeconds, 30);
  assert.equal(l.check("a", 61_000).allowed, true);
});

test("unseen keys share one bucket once the table is full", () => {
  const l = createRateLimiter({ perKeyLimit: 2, globalLimit: 100, windowMs: 60_000, maxKeys: 2 });
  assert.equal(l.check("a", 0).allowed, true);
  assert.equal(l.check("b", 0).allowed, true);
  assert.equal(l.check("c", 0).allowed, true);
  assert.equal(l.check("d", 0).allowed, true);
  assert.equal(l.check("e", 0).allowed, false);
  // Known keys keep their own bucket.
  assert.equal(l.check("a", 0).allowed, true);
});
