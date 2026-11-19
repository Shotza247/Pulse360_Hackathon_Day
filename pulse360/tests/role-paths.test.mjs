import test from "node:test";
import assert from "node:assert/strict";
import { canRoleAccessPath } from "../src/lib/role-paths.ts";

test("HR_ADMIN can open the RAG page and its subpaths", () => {
  assert.equal(canRoleAccessPath("HR_ADMIN", "/system-admin/rag"), true);
  assert.equal(canRoleAccessPath("HR_ADMIN", "/system-admin/rag/anything"), true);
});

test("HR_ADMIN stays blocked from every other /system-admin page", () => {
  assert.equal(canRoleAccessPath("HR_ADMIN", "/system-admin"), false);
  assert.equal(canRoleAccessPath("HR_ADMIN", "/system-admin/companies"), false);
  assert.equal(canRoleAccessPath("HR_ADMIN", "/system-admin/analytics"), false);
});

test("the HR_ADMIN exception does not match look-alike paths", () => {
  assert.equal(canRoleAccessPath("HR_ADMIN", "/system-admin/ragged"), false);
  assert.equal(canRoleAccessPath("HR_ADMIN", "/system-admin/rag-evil"), false);
});

test("other roles gain nothing from the exception", () => {
  assert.equal(canRoleAccessPath("LINE_MANAGER", "/system-admin/rag"), false);
  assert.equal(canRoleAccessPath("EMPLOYEE", "/system-admin/rag"), false);
  assert.equal(canRoleAccessPath("UNKNOWN", "/system-admin/rag"), false);
});

test("existing role paths are unchanged", () => {
  assert.equal(canRoleAccessPath("SYSTEM_ADMIN", "/system-admin"), true);
  assert.equal(canRoleAccessPath("SYSTEM_ADMIN", "/system-admin/rag"), true);
  assert.equal(canRoleAccessPath("SYSTEM_ADMIN", "/employees"), false);
  assert.equal(canRoleAccessPath("HR_ADMIN", "/employees"), true);
  assert.equal(canRoleAccessPath("EMPLOYEE", "/reviews"), true);
  assert.equal(canRoleAccessPath("EMPLOYEE", "/cycles"), false);
});
