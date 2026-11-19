import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_GOLDEN_SAMPLES,
  parseSamplesCsv,
  validateSampleInput,
} from "../src/lib/rag-samples.ts";
import { RAG_TOOL_ROLES, isRagRoleAllowed } from "../src/lib/rag-roles.ts";

test("sample management allows both SYSTEM_ADMIN and HR_ADMIN", () => {
  assert.equal(isRagRoleAllowed("SYSTEM_ADMIN", RAG_TOOL_ROLES), true);
  assert.equal(isRagRoleAllowed("HR_ADMIN", RAG_TOOL_ROLES), true);
  assert.equal(isRagRoleAllowed("EMPLOYEE", RAG_TOOL_ROLES), false);
  assert.equal(isRagRoleAllowed("LINE_MANAGER", RAG_TOOL_ROLES), false);
});

test("validateSampleInput accepts valid inputs and normalizes category", () => {
  const result = validateSampleInput({
    question: "How do 360 review nominations work?",
    approved_answer: "Employees can nominate up to 5 peers during the Nominate cycle phase.",
    category: "platform",
  });

  assert.equal(result.valid, true);
  assert.equal(result.clean?.category, "platform");
  assert.equal(result.clean?.is_active, true);
});

test("validateSampleInput rejects inputs with short question or answer", () => {
  const shortQ = validateSampleInput({
    question: "Hi",
    approved_answer: "This is a valid answer for the question.",
  });
  assert.equal(shortQ.valid, false);

  const shortA = validateSampleInput({
    question: "Valid Question Here?",
    approved_answer: "No",
  });
  assert.equal(shortA.valid, false);
});

test("parseSamplesCsv parses valid CSV and reports errors on invalid rows", () => {
  const csv = `question,approved_answer,category
"What is the annual discount?","Annual billing saves 15% upfront.",pricing
"X","Too short question",platform`;

  const { samples, errors } = parseSamplesCsv(csv);
  assert.equal(samples.length, 1);
  assert.equal(samples[0].category, "pricing");
  assert.equal(errors.length, 1);
});

test("DEFAULT_GOLDEN_SAMPLES contains standard core platform questions", () => {
  assert.ok(DEFAULT_GOLDEN_SAMPLES.length >= 5);
  for (const s of DEFAULT_GOLDEN_SAMPLES) {
    assert.ok(s.question.length > 5);
    assert.ok(s.approved_answer.length > 10);
    assert.ok(s.category.length > 0);
  }
});
