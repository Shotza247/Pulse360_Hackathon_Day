import test from "node:test";
import assert from "node:assert/strict";
import { RAG_CATEGORIES, RAG_ASK_TIMEOUT_MS, isRagTimeout } from "../src/lib/rag-api.ts";
import { RAG_TOOL_ROLES, isRagRoleAllowed } from "../src/lib/rag-roles.ts";

test("admin chat tester allows both SYSTEM_ADMIN and HR_ADMIN", () => {
  assert.equal(isRagRoleAllowed("SYSTEM_ADMIN", RAG_TOOL_ROLES), true);
  assert.equal(isRagRoleAllowed("HR_ADMIN", RAG_TOOL_ROLES), true);
  assert.equal(isRagRoleAllowed("LINE_MANAGER", RAG_TOOL_ROLES), false);
  assert.equal(isRagRoleAllowed("EMPLOYEE", RAG_TOOL_ROLES), false);
});

test("admin chat tester timeout allows the full 60s ask window", () => {
  assert.equal(RAG_ASK_TIMEOUT_MS, 60_000);
});

test("admin chat tester validates category filter against allowed RAG_CATEGORIES", () => {
  assert.ok(RAG_CATEGORIES.includes("platform"));
  assert.ok(RAG_CATEGORIES.includes("pricing"));
  assert.ok(RAG_CATEGORIES.includes("privacy"));
  assert.ok(RAG_CATEGORIES.includes("security"));
  assert.ok(RAG_CATEGORIES.includes("analytics"));
  assert.ok(!RAG_CATEGORIES.includes("invalid_category_xyz"));
});

test("isRagTimeout properly flags AbortError and TimeoutError", () => {
  const abortErr = new Error("aborted");
  abortErr.name = "AbortError";
  assert.equal(isRagTimeout(abortErr), true);

  const timeoutErr = new Error("timed out");
  timeoutErr.name = "TimeoutError";
  assert.equal(isRagTimeout(timeoutErr), true);

  const syntaxErr = new SyntaxError("Unexpected token");
  assert.equal(isRagTimeout(syntaxErr), false);
});
