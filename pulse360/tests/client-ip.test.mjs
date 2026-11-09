import test from "node:test";
import assert from "node:assert/strict";
import { getClientIp } from "../src/lib/client-ip.ts";

const headers = (value) => new Headers(value === undefined ? {} : { "x-forwarded-for": value });

test("returns the first forwarded address", () => {
  assert.equal(getClientIp(headers("203.0.113.7, 10.0.0.1")), "203.0.113.7");
});

test("accepts IPv6", () => {
  assert.equal(getClientIp(headers("2001:db8::1")), "2001:db8::1");
});

test("returns null when the header is missing", () => {
  assert.equal(getClientIp(headers()), null);
});

test("returns null for values that are not IP addresses", () => {
  assert.equal(getClientIp(headers("not-an-ip")), null);
  assert.equal(getClientIp(headers("")), null);
  assert.equal(getClientIp(headers("203.0.113.7:8080")), null);
});
