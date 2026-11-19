import test from "node:test";
import assert from "node:assert/strict";
import {
  isRagDocumentId,
  isRagTimeout,
  RAG_ASK_TIMEOUT_MS,
  RAG_COMMIT_TIMEOUT_MS,
  RAG_DEFAULT_TIMEOUT_MS,
  RAG_DELETE_TIMEOUT_MS,
  RAG_PREVIEW_TIMEOUT_MS,
} from "../src/lib/rag-api.ts";
import { RAG_MAX_UPLOAD_BYTES, RAG_MAX_UPLOAD_LABEL } from "../src/lib/rag-limits.ts";

test("timeouts grow with the work each call triggers", () => {
  assert.ok(RAG_DEFAULT_TIMEOUT_MS < RAG_PREVIEW_TIMEOUT_MS);
  assert.ok(RAG_PREVIEW_TIMEOUT_MS < RAG_COMMIT_TIMEOUT_MS);
});

test("/ask waits for both upstream calls at the RAG default REQUEST_TIMEOUT of 30 s", () => {
  assert.ok(RAG_ASK_TIMEOUT_MS >= 2 * 30_000);
});

test("delete is a single-transaction call, so it needs no more than the default wait", () => {
  assert.ok(RAG_DELETE_TIMEOUT_MS <= RAG_DEFAULT_TIMEOUT_MS);
});

test("only UUIDs are accepted as document IDs for the upstream delete path", () => {
  assert.equal(isRagDocumentId("3f2b8c1e-5a4d-4e8f-9b6a-1c2d3e4f5a6b"), true);
  assert.equal(isRagDocumentId("3F2B8C1E-5A4D-4E8F-9B6A-1C2D3E4F5A6B"), true);
  assert.equal(isRagDocumentId("not-a-uuid"), false);
  assert.equal(isRagDocumentId(""), false);
  assert.equal(isRagDocumentId("../collections"), false);
  assert.equal(isRagDocumentId("3f2b8c1e-5a4d-4e8f-9b6a-1c2d3e4f5a6b/extra"), false);
});

test("recognises fetch timeouts and aborts, but not other failures", () => {
  assert.equal(isRagTimeout(new DOMException("timed out", "TimeoutError")), true);
  assert.equal(isRagTimeout(new DOMException("aborted", "AbortError")), true);
  assert.equal(isRagTimeout(new TypeError("fetch failed")), false);
  assert.equal(isRagTimeout("TimeoutError"), false);
  assert.equal(isRagTimeout(null), false);
});

test("upload limit stays under the Vercel request-body cap and matches its label", () => {
  assert.ok(RAG_MAX_UPLOAD_BYTES <= 4 * 1024 * 1024);
  assert.equal(RAG_MAX_UPLOAD_LABEL, `${RAG_MAX_UPLOAD_BYTES / (1024 * 1024)} MB`);
});
