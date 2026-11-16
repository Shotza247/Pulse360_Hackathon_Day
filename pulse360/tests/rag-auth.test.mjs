import test from "node:test";
import assert from "node:assert/strict";
import { RAG_TOOL_ROLES, RAG_MUTATION_ROLES, isRagRoleAllowed } from "../src/lib/rag-roles.ts";

test("RAG_TOOL_ROLES includes SYSTEM_ADMIN and HR_ADMIN", () => {
  assert.deepEqual([...RAG_TOOL_ROLES], ["SYSTEM_ADMIN", "HR_ADMIN"]);
});

test("RAG_MUTATION_ROLES only permits SYSTEM_ADMIN", () => {
  assert.deepEqual([...RAG_MUTATION_ROLES], ["SYSTEM_ADMIN"]);
});

test("isRagRoleAllowed correctly evaluates tool roles", () => {
  assert.equal(isRagRoleAllowed("SYSTEM_ADMIN", RAG_TOOL_ROLES), true);
  assert.equal(isRagRoleAllowed("HR_ADMIN", RAG_TOOL_ROLES), true);
  assert.equal(isRagRoleAllowed("LINE_MANAGER", RAG_TOOL_ROLES), false);
  assert.equal(isRagRoleAllowed("EMPLOYEE", RAG_TOOL_ROLES), false);
  assert.equal(isRagRoleAllowed(null, RAG_TOOL_ROLES), false);
  assert.equal(isRagRoleAllowed(undefined, RAG_TOOL_ROLES), false);
});

test("isRagRoleAllowed correctly evaluates mutation roles", () => {
  assert.equal(isRagRoleAllowed("SYSTEM_ADMIN", RAG_MUTATION_ROLES), true);
  assert.equal(isRagRoleAllowed("HR_ADMIN", RAG_MUTATION_ROLES), false);
  assert.equal(isRagRoleAllowed("LINE_MANAGER", RAG_MUTATION_ROLES), false);
  assert.equal(isRagRoleAllowed("EMPLOYEE", RAG_MUTATION_ROLES), false);
});
