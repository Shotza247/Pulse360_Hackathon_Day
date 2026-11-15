# RAG Evaluation and Tuning Plan

Companion to [RAG Integration Fix Plan](RAG_INTEGRATION_FIX_PLAN.md). Covers a System Admin workflow to
delete documents, test the chatbot, score its answers against company-approved answers, and make the
assistant check its answers against company documentation before replying.

## Overview

**Goal.** Give System Admins a place to measure and improve how the FAQ assistant answers company
questions, and make the assistant verify its answers against approved sources instead of only
retrieving text and summarising it.

**Decisions already made**

| Topic | Decision |
|---|---|
| Score | Hybrid: embedding similarity to the approved answer, plus an LLM judge for factual coverage and contradictions. Final percentage is a 50/50 weighted blend to start, tuned from admin ratings. Any contradiction caps the score. |
| Below 75% | Runtime verify-and-revise loop. A verifier checks the answer against retrieved chunks and approved answers. A failed answer is regenerated once with the failures and the company style as guidance. |
| Ownership | The RAG API owns everything: new `rag.*` tables in Supabase, scoring and verifier logic in Python, admin-only endpoints. Pulse360 stays a thin proxy plus UI, as it is for ingestion. |
| Release | Phase 1: HR Admin access, document delete, admin chat tester, evaluation workbench, reranking. Phase 2: verify-and-revise loop, approved-answer source, style guidance. |
| Users | System Admin and HR Admin both use the FAQ tools, on the existing `/system-admin/rag` page as tabs. Only System Admin uploads or deletes documents; HR Admin can view the list. |

**What "the LLM improves" means here.** The hosted model cannot be retrained from this app. Improvement
comes from what the system feeds and checks around the model: better retrieval, approved answers as
evidence and style examples, a verification pass, and tuned settings. Phase 1 measures; Phase 2 acts.

**Findings that shape the design**

1. **Approved answers must not grade themselves.** In Phase 2 the approved answers become a retrievable
   source. If an evaluation run can retrieve the very answer it is graded against, it will score close to
   100% and prove nothing. Evaluation runs must exclude the sample under test from the approved-answer
   source (leave one out), and Phase 2 must be judged on that basis.
2. **Embedding similarity is not a percentage.** The embedding model produces cosine values that cluster in
   a narrow high range even for unrelated sentences, so a raw value shown as a percent would mislead.
   The mapping to a 0-100 scale must be calibrated against admin ratings before the 75% line is trusted.
3. **The judge is the same kind of model as the answerer.** It can favour its own phrasing. The judge must
   return structured output at temperature zero, and the UI must show the components (similarity,
   coverage, contradictions, rationale), not only one number.
4. **Failure type matters.** A low score can mean retrieval missed the facts, the model got them but wrote
   a wrong answer, or the wording differs from company style. Each needs a different fix, so each result
   records which one it was.
5. **Evaluation runs are long.** Many samples with three model calls each cannot fit in one serverless
   request (see the timeout notes in the fix plan). Runs are executed one sample per request, driven by
   the UI, with results saved as they arrive.
6. **The public route must stay lean.** The admin tester needs retrieved text and scores, which fix 11 of
   the fix plan says the public route should stop exposing. Admin detail therefore goes through a separate
   admin-only endpoint, not the public one.
7. **Audit identifiers.** The Pulse360 audit helper takes a numeric `entityId`, but document IDs are UUIDs.
   Document IDs go in the audit `metadata`.

**Out of scope.** Fine-tuning model weights, a Google Drive connector, DOCX ingestion, and any change to the
public landing page chatbot beyond what Phase 2 requires.

**Precondition (sub-task 0).** The RAG repository has diverged: GitHub has the config fix `d5607fc`, and the
local scratch clone has the upload limit and retry budget on top of an earlier version of that fix.
Reconcile and merge before building on it.

```
Phase 1:  [0 reconcile] -> [1a HR access] -> [1 delete] -> [2 admin tester] -> [3 eval data model] -> [4 scoring] -> [4b rerank] -> [5 workbench UI]
Phase 2:  [6 approved answers + style] -> [7 verify-and-revise] -> [8 measure and decide]
```

---

## Sub-tasks

### 0. Reconcile and merge the pending RAG changes

- **Intent:** Start from one agreed RAG baseline so new work does not stack on a diverged branch.
- **Expected outcomes:** One RAG branch containing the pushed config fix, the 4 MB upload limit, the retry
  budget and the test isolation; merged to `main`; the Learning Folder copy and the scratch clone both at
  that commit.
- **Todo list:**
  1. Inspect the current state of the scratch clone (its config files were edited outside this session).
  2. Rebase the upload-limit and retry-budget commits onto GitHub's `fix/rag-integration-hardening`.
  3. Keep the pushed config fix; keep the test-isolation fixture and the extra overlap test.
  4. Run the full RAG suite; confirm only the two known Streamlit failures remain.
  5. Hand the user one fast-forward fetch and push command; merge the PR.
- **Relevant context:** `src/faq_agent/config.py`, `tests/test_config.py`, `tests/conftest.py` in the RAG repo.
- **Status:** `[x] done (rebased onto origin/main 62cf6ac+; commits ee99725 upload limit, d4d0584 retry budget, 2abd642 overlap test, 495c99a .env-independent API tests. Suite: 132 passed, 2 known Streamlit failures, with or without a .env)`
  - **Handoff note for sub-task 1a (HR Admin access in Pulse360):** RAG baseline is unified and ready on `fix/rag-integration-hardening`. Sub-task 1a takes place inside the Pulse360 repository (`pulse360/src/proxy.ts`, `Sidebar.tsx`, RAG routes) to grant HR Admin role access to `/system-admin/rag` tabs and tools while restricting document mutations (upload/commit/delete) to System Admin.

### 1a. HR Admin access to the RAG page

- **Intent:** HR Admins know how the assistant should answer, so they need to reach the same tools as System
  Admins, without opening other System Admin pages.
- **Expected outcomes:**
  - HR Admin can open `/system-admin/rag` and use its tabs; every other `/system-admin` page stays System Admin only.
  - HR Admin can call the tools routes (chat tester, samples, evaluation, style guide) and the document list
    route; upload, commit and delete stay System Admin only. The role check is one shared helper instead of
    the inline check repeated in each route.
  - HR Admin sees a "FAQ Assistant" entry in the sidebar; a System Admin still sees "FAQ Sources".
  - Actions by either role are attributed to the user in the audit log.
- **Todo list:**
  1. Add the narrow path exception for HR Admin in the route guard (`proxy.ts`), keeping `/system-admin`
     itself closed to HR Admin.
  2. `[x]` Extract one authorization helper that takes the allowed roles (`rag-auth.ts`, `rag-roles.ts`), and use it in the existing three routes and all new ones (`RAG_TOOL_ROLES` for list/tools, `RAG_MUTATION_ROLES` for upload/commit/delete).
  3. The documents tab hides upload and delete for HR Admin, and the upload, commit and delete routes reject
     HR Admin on the server, not only in the UI. The list route and all tools routes allow both roles.
  4. Update the page-level role check and the sidebar roles.
  5. `[x]` Tests for the helper role tiers (`tests/rag-auth.test.mjs`) and route protection.
- **Relevant context:** `pulse360/src/proxy.ts` (`ROLE_PATHS`, prefix matching); `pulse360/src/components/Sidebar.tsx`
  (`roles`); `pulse360/src/app/(app)/system-admin/rag/page.tsx`; the routes in
  `pulse360/src/app/api/system-admin/rag/`. Note `proxy.ts` matches by path prefix, so the exception must be
  the exact RAG path and must not widen to `/system-admin`.
- **Status:** `[-] in progress (shared auth helper extracted & routes refactored with unit tests)`

### 1. Document delete (RAG API and admin UI)

- **Intent:** Let a System Admin remove a bad or outdated upload, which the fix plan lists as missing (fix 10).
  Delete is System Admin only; HR Admin sees no delete control.
- **Expected outcomes:**
  - An admin-key-only delete endpoint removes a document and all of its chunks and embeddings in one
    transaction, scoped to the collection, and returns 404 for an unknown document.
  - The documents list in the admin page has a delete action with a confirmation step naming the file and
    its chunk count.
  - Each delete writes an audit event with the document ID, filename and chunk count.
  - Re-uploading the same file after a delete works (duplicate detection must no longer block it).
- **Todo list:**
  1. RAG: add a delete method that removes chunks first, then the document, in one transaction, mirroring
     the existing smoke-test delete script (no reliance on database cascades, which are not defined in this repo).
  2. RAG: add the admin-protected `DELETE` route and tests: success, unknown ID, wrong collection, missing key.
  3. Pulse360: add a System Admin-only proxy route; write an audit event with the UUID in `metadata`.
  4. Pulse360: add the delete button, confirmation, and list refresh; handle both error shapes already
     used by the page.
  5. Confirm saved evaluation results keep working after a delete (they store snapshots, not live links).
- **Relevant context:** `src/faq_agent/supabase_store.py` (`documents`, `commit`), `src/faq_agent/api/documents.py`,
  `scripts/delete_supabase_test_document.py` in the RAG repo; `pulse360/src/app/api/system-admin/rag/documents/route.ts`,
  `pulse360/src/components/RagIngestionWorkspace.tsx`, `pulse360/src/lib/audit.ts`.
- **Status:** `[ ] pending`

### 2. Admin chat tester

- **Intent:** Let System Admins and HR Admins ask questions exactly as a visitor would and also see what the
  system retrieved, so they can judge accuracy.
- **Expected outcomes:**
  - A new tab on the existing `/system-admin/rag` page with a chat panel that behaves like the landing page chatbot.
  - Beside each answer: status, cited sources, the retrieved chunk text with relevance scores, and timing.
  - It uses an admin-only RAG endpoint, so the public route and its rate limits are untouched.
  - The tester has its own request limit so an admin cannot run up model cost by accident.
- **Todo list:**
  1. RAG: add an admin-key endpoint that runs the normal answer pipeline and returns full detail
     (all retrieved chunks with scores, the final answer, status, timings, active settings).
  2. RAG: apply a modest rate limit and the collection allowlist to this endpoint.
  3. Pulse360: add a System Admin proxy route with the longer `/ask`-style timeout.
  4. Pulse360: build a React chat component that mirrors the landing page chatbot behaviour (the landing
     chatbot is inline HTML in `public/landing.html` and is not reusable) with a details panel.
  5. Tests for the endpoint and the proxy authorization.
- **Relevant context:** landing chatbot in `pulse360/public/landing.html` (`askPulse360`, `addChatbotMessage`);
  `src/faq_agent/api/routes.py`, `retrieval/retriever.py`, `llm/client.py` in the RAG repo;
  `pulse360/src/lib/rag-api.ts` timeouts.
- **Status:** `[ ] pending`

### 3. Evaluation data model and sample management

- **Intent:** Store sample questions, approved ("gold") answers and run results so quality can be tracked over time.
- **Expected outcomes:**
  - A numbered SQL migration (next after `002`) that creates tables for samples, runs and per-sample results.
  - Samples hold: question, approved answer, category, active flag, who created it and when.
  - Runs record a snapshot of the settings in force (LLM model, embedding model, retrieval depth, prompt
    version, pass threshold) so results stay comparable after changes.
  - Results hold: the model's answer, status, sources, each score component, final score, pass or fail,
    failure type, judge rationale, and an optional admin rating and note.
  - Admin-key endpoints to list, create, edit, delete, and bulk-import samples (CSV or JSON).
  - The user applies the migration to Supabase by hand, since the schema is managed there.
- **Todo list:**
  1. Design the tables and indexes; add the migration file and README/deployment note on applying it.
  2. RAG: store layer and endpoints for samples, with validation (length limits, duplicates).
  3. Bulk import with a preview step showing what will be created, matching the ingestion pattern.
  4. Pulse360: System Admin proxy routes and audit events for sample create, edit, delete.
  5. Tests with a stubbed database layer, as done for upload limits.
- **Relevant context:** `docs/migrations/001_add_rag_previews.sql`, `002_add_rate_limits.sql`;
  `src/faq_agent/supabase_store.py` (connection and preview patterns); `scripts/evaluate_retrieval.py`
  (existing question file format).
- **Status:** `[ ] pending`

### 4. Hybrid scoring and failure diagnosis

- **Intent:** Turn "how close is the answer to the company answer" into a score the admin can trust and act on.
- **Expected outcomes:**
  - The default blend is 50% embedding similarity and 50% LLM judge, both configurable.
  - For one sample, the service runs the real answer pipeline, then computes: embedding similarity between
    the model answer and the approved answer (calibrated to a 0-100 scale), and an LLM judge result
    (factual coverage 0-100, a list of contradictions, a short rationale).
  - Final score is a configurable weighted blend; any contradiction caps it below the pass threshold.
  - The threshold defaults to 75% and is configurable.
  - Each result is tagged: retrieval gap, synthesis gap, style gap, or pass. The tag comes from whether the
    approved answer's facts appear in the retrieved chunks.
  - Abstentions ("not enough information") are scored and tagged, not dropped.
  - A calibration view compares automatic scores with admin ratings, so weights and the similarity mapping
    can be adjusted with evidence.
- **Todo list:**
  1. Define the judge prompt and strict JSON output; reject and retry malformed judge output once.
  2. Implement similarity scoring with the existing embedding client (document-side embedding for both texts).
  3. Implement the blend, contradiction cap and threshold from settings.
  4. Implement failure tagging using the retrieved chunks.
  5. Admin endpoint to run one sample and save the result; bounded retries using the existing retry budget.
  6. Unit tests with stubbed model calls: pass, near-miss, contradiction cap, abstention, malformed judge output.
  7. Record cost signals (calls and tokens where available) per run.
- **Relevant context:** `src/faq_agent/embeddings/embedder.py`, `llm/client.py`, `prompts/templates.py`,
  `config.py` in the RAG repo; the retry-budget change from sub-task 0.
- **Note on `ragas` (installed locally by the user, 0.4.4):** do not make it a runtime dependency of the Vercel
  API. It pulls in a large dependency tree, which risks the function size limit and cold start. Use it offline,
  as a cross-check of the in-house score: run it over exported results and compare its faithfulness and
  answer-correctness values with the admin ratings during the calibration step. Decide later whether to adopt
  any of its metrics. The in-house judge stays small, with stubbed tests and the retry budget.
- **Status:** `[ ] pending`

### 4b. Reranking of retrieved chunks

- **Intent:** Improve which evidence the model sees, so fewer low scores come from retrieval misses. Today
  `rerank_score` is declared in the response models but never set, and `/ask` is documented as "no reranking".
- **Expected outcomes:**
  - After vector search retrieves a wider candidate set, a reranker scores each chunk against the question and
    only the best few go to the model.
  - `rerank_score` is populated and shown in the admin tester and in evaluation results.
  - Reranking is a setting (on, off), with the candidate count and final count configurable, so its effect
    can be measured on the same samples.
  - If the reranker is unavailable or slow, the system falls back to vector order and records that it did.
  - Reranking stays a separate item from the score blend: it changes what the model reads, not how answers are graded.
- **Todo list:**
  1. Confirm the reranker model and access (open question 2).
  2. Widen vector retrieval to a candidate count, then rerank to the existing context size; keep the SQL
     function unchanged (it is defined in Supabase, not in this repo).
  3. Fill `rerank_score` through the existing schema fields; keep the public response lean (fix 11).
  4. Add the setting, the fallback and a time budget within the retry limits already set.
  5. Tests with a stubbed reranker: reorder, fallback, disabled.
  6. Compare retrieval with and without reranking on the first sample set before deciding the default.
- **Relevant context:** `src/faq_agent/supabase_store.py` (`search`, which sets `rerank_score` to `None`),
  `src/faq_agent/schemas.py` and `src/faq_agent/api/routes.py` (`rerank_score` fields),
  `src/faq_agent/retrieval/retriever.py`, `src/faq_agent/config.py`.
- **Status:** `[ ] pending`

### 5. Evaluation workbench UI

- **Intent:** One screen for System Admins and HR Admins to manage samples, run them, read the comparison,
  and rate the answers.
- **Expected outcomes:**
  - New tabs on the existing `/system-admin/rag` page (Sources, Chat tester, Evaluation); HR Admin sees the
    same page and tabs.
  - Sample list with add, edit, delete and import.
  - Run controls: run one, run selected, run all active, with progress. The UI sends one sample per request.
  - Results table with the model answer and the approved answer side by side, the score and its components,
    the failure tag, and a red flag below 75%.
  - Admin rating and note on each result; run history with pass rate, mean score and abstain rate, and a
    comparison between two runs.
  - Export of a run to CSV.
- **Todo list:**
  1. Add the tab layout to the existing RAG page, and a sidebar entry for HR Admin (see sub-task 1a).
  2. Build the sample manager and import flow.
  3. Build the run driver (sequential or lightly parallel, cancellable, resumable after refresh).
  4. Build the side-by-side result view and rating controls.
  5. Build run history and comparison.
  6. Pulse360 unit tests for the pure helpers; typecheck and lint.
- **Relevant context:** `pulse360/src/components/RagIngestionWorkspace.tsx` (patterns for upload, stages, error
  handling); `pulse360/src/app/(app)/system-admin/rag/page.tsx` (role guard); `pulse360/src/lib/rag-api.ts`.
- **Status:** `[ ] pending`

**Phase 1 checkpoint.** Run a first evaluation on real company questions. Use the results to calibrate the
similarity mapping and blend weights, and to decide the Phase 2 defaults. Do not start Phase 2 before this.

### 6. Approved answers and style guidance (Phase 2)

- **Intent:** Let company answers shape the assistant, as evidence and as examples of tone, without making
  evaluation circular.
- **Expected outcomes:**
  - An admin can promote a sample's approved answer to "approved" status, which makes it retrievable as a
    labelled source distinct from uploaded documents.
  - At answer time, the closest approved answers are supplied to the model as style examples and as
    evidence, and shown in citations as approved answers.
  - An admin-editable style guide (versioned) is appended to the prompt. It cannot override the safety rules
    already in the system prompt.
  - Evaluation runs exclude the sample under test from this source (leave one out), and results record that.
- **Todo list:**
  1. Extend the data model for approved status and the embedded question.
  2. Retrieval changes: search approved answers alongside document chunks; cap how many are used.
  3. Prompt changes: style examples and the versioned style guide, with length limits.
  4. Leave-one-out switch in evaluation runs; tests proving a sample cannot retrieve itself.
  5. Admin UI for promote, demote and edit style guide, with audit events.
- **Relevant context:** `src/faq_agent/supabase_store.py` (`search`), `retrieval/retriever.py`,
  `prompts/templates.py`; the `rag.match_document_chunks` function, which is defined in Supabase and not in this repo.
- **Status:** `[ ] pending`

### 7. Verify-and-revise loop (Phase 2)

- **Intent:** Make every answer checked against the company sources before it is returned.
- **Expected outcomes:**
  - After the first answer, a verifier checks each claim against the retrieved chunks and the matching
    approved answers, and returns pass or a list of problems.
  - On failure, the model regenerates once, given the problems and the style examples.
  - If the second answer still fails, the assistant returns the safe "not enough information" reply and
    logs why (see open question 2).
  - The loop is switchable by setting and per request in the admin tester, so its effect can be compared.
  - Latency, call count and timeouts stay within the limits set in the fix plan.
- **Todo list:**
  1. Define the verifier prompt and strict JSON result.
  2. Add the loop to the answer pipeline behind a setting; record each step in the response detail for admins.
  3. Rework timeout and retry budgets for up to four model calls per question; update Pulse360 timeouts.
  4. Re-check the public rate limits against the higher cost per question.
  5. Tests: verifier pass, verifier fail then recover, fail twice, malformed verifier output.
- **Relevant context:** `src/faq_agent/llm/client.py` (`synthesize`, `validate_answer`), `api/routes.py`,
  `pulse360/src/lib/rag-api.ts`, `pulse360/src/app/api/faq/ask/route.ts`.
- **Status:** `[ ] pending`

### 8. Measure and decide (Phase 2)

- **Intent:** Keep the loop only if it improves answers enough to justify its cost and delay.
- **Expected outcomes:** A comparison of pass rate, mean score, abstain rate and latency with the loop off and
  on, using leave-one-out; a recorded decision and the defaults to ship.
- **Todo list:**
  1. Run the same sample set with the loop off, then on.
  2. Review the comparison with the admin; adjust threshold, weights, retrieval depth.
  3. Update deployment notes, smoke test and the fix plan.
- **Relevant context:** the workbench from sub-task 5; `docs/operations/DEPLOYMENT.md`.
- **Status:** `[ ] pending`

---

## Cross-cutting requirements

- **Security:** every new RAG endpoint requires the admin key and sits behind the shared System Admin /
  HR Admin check in Pulse360 (sub-task 1a); gold answers and retrieved text are never returned by public
  routes.
- **Audit:** delete, sample changes, runs, promote and style guide changes write audit events.
- **Cost control:** run size limits, per-endpoint rate limits, and token or call counts shown per run.
- **Testing:** pytest for RAG (stubbed models and database), node tests for Pulse360 helpers, typecheck and lint.
- **Delivery:** one sub-task at a time on the existing hardening branch pattern; review, commit, then wait for approval.

## Decisions confirmed

| Question | Decision |
|---|---|
| Score blend | Start at 50% embedding similarity and 50% LLM judge; tune both from admin ratings. |
| Reranking | Introduced as a retrieval step (sub-task 4b). It is not part of the score. |
| Revised answer still fails verification | Return the safe "not enough information" reply and log why. |
| Where the screens live | The current page, `/system-admin/rag`, as tabs. |
| Who may use the chat tester, samples, evaluation and style guide | System Admin and HR Admin. HR managers know how the assistant should answer. |
| Who may upload or delete documents | System Admin only. HR Admin can view the document list. |
| Reconcile the RAG branches first | Yes (sub-task 0). |

## Open questions

1. **Reranker choice (sub-task 4b).** A hosted cross-encoder reranker through the existing Hugging Face
   token (proposed), or an LLM-based rerank at higher cost and latency. Confirm which models the account can call.
2. Vercel's function time limit for the RAG API is not configured in this repo and depends on the plan;
   confirm the plan before sub-task 7.

## Risks

- Judge and calibration errors can make the 75% line look more precise than it is.
- The Supabase schema and the vector search function are not defined in either repository, so migrations here
  cover only new tables and the search change in sub-task 6 must be written against the live function.
- Extra model calls per question raise cost and delay on the public chatbot once the loop is enabled.
