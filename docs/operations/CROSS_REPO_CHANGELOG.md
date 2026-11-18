# Cross-Repo Changelog

One place that records changes in both repositories that make up the FAQ assistant:

| Tag | Repository | Role |
|---|---|---|
| `pulse360` | [Pulse360_Hackathon_Day](https://github.com/Shotza247/Pulse360_Hackathon_Day) (this repo) | Next.js app, System Admin / HR Admin UI, thin proxy to the RAG API |
| `rag` | [Supabas_pulse360_RAG](https://github.com/Shotza247/Supabas_pulse360_RAG) | FastAPI RAG service: ingestion, retrieval, answers, (planned) scoring |

Plan: [RAG Evaluation and Tuning Plan](RAG_EVALUATION_TUNING_PLAN.md). Deploy order and smoke test: [Deployment Runbook](DEPLOYMENT.md).

## How to update this file

1. Run `./scripts/sync-changelog.ps1` from the repo root. It fetches both repos, appends new commits to
   **Entries**, rewrites **Pending**, and moves the pin markers forward.
2. By hand, update **Deployed together** and **Feature tracker** when something ships or changes state.
3. The RAG repo is read from `.bob/tmp/Supabas_pulse360_RAG`. Use `-RagPath <path>` or the `RAG_REPO_PATH`
   environment variable for another location. `-DryRun` previews without writing.

Do not edit the text between the `<!-- ...:START -->` and `<!-- ...:END -->` markers or the `pin` markers.
The script owns them.

## Deployed together

Fill in when you deploy. A feature that spans both repos works only when both commits below are live.

| Date | Pulse360 commit | RAG commit | Notes |
|---|---|---|---|
| _not recorded_ | | | Record the first deploy after this file is merged. |

## Feature tracker

Status values: `pending`, `in progress`, `merged`, `deployed`. Sub-task numbers match the plan.

| Sub-task | Feature | Pulse360 | RAG | Manual step | Status |
|---|---|---|---|---|---|
| 0 | Reconcile RAG branches | n/a | Branch `fix/rag-upload-limit-retry-budget` pushed on top of RAG `main` (4 MB upload limit, retry cap, test isolation). Open the PR. | Merge the PR, then redeploy the RAG API | in progress (pushed, PR not opened) |
| 1a | HR Admin access | Done on branch: shared role helper (a4718f); route-guard exception for the exact path /system-admin/rag, page check, sidebar FAQ Assistant entry, upload and commit controls hidden for HR Admin, upload, preview and commit rejected server-side | none | none | merged to branch, not yet in main or deployed |
| 1 | Document delete | pending | pending | none | pending |
| 2 | Admin chat tester | pending | pending | none | pending |
| 3 | Evaluation data model | pending | pending | Apply the new SQL migration in Supabase by hand | pending |
| 4 | Hybrid scoring | pending | pending | none | pending |
| 4b | Reranking | pending | pending | Confirm reranker choice | pending |
| 5 | Evaluation workbench UI | pending | none | none | pending |
| 6-8 | Phase 2 | pending | pending | Confirm Vercel time limit before 7 | pending |

Deploy order for a feature that touches both repos: RAG API first, then Pulse360.

## Pending (not yet in `main`)

<!-- PENDING:START -->
**pulse360** on `fix/rag-integration-hardening`: 5 commit(s) not in main, 2 uncommitted file(s).

- `eeeb727` feat(rag): give HR Admin read-only access to the FAQ sources page
- `a5d9c1e` docs(rag): sync cross-repo changelog and merge same-day headings in the script
- `0748ce8` docs(rag): add cross-repo changelog ledger and sync script
- `fa4718f` feat(rag): add shared auth tiers and update documentation
- `a91e07a` docs(rag): mark sub-task 0 done and note ragas as an offline cross-check
- uncommitted: `M docs/operations/CROSS_REPO_CHANGELOG.md`
- uncommitted: `M docs/operations/RAG_EVALUATION_TUNING_PLAN.md`

**rag** on `fix/rag-upload-limit-retry-budget`: 4 commit(s) not in main, 0 uncommitted file(s).

- `9cb07fc` test(api): keep CORS and open-local tests independent of a developer .env
- `97201a4` test(config): add overlap-rejection test and isolate test suite from .env
- `529192e` fix(retry): cap total provider retry time at two request timeouts
- `e90850d` fix(upload): cap uploads at 4 MB and explain chunk and OCR rejections
<!-- PENDING:END -->

## Entries

Newest first. Merge commits are omitted. Tags: **[pulse360]**, **[rag]**.

<!-- pin:pulse360=eeeb727 -->
<!-- pin:rag=9cb07fc -->

<!-- ENTRIES:START -->
### 2026-11-18
- **[pulse360]** `eeeb727` feat(rag): give HR Admin read-only access to the FAQ sources page

### 2026-11-17
- **[pulse360]** `a5d9c1e` docs(rag): sync cross-repo changelog and merge same-day headings in the script
- **[pulse360]** `0748ce8` docs(rag): add cross-repo changelog ledger and sync script
- **[rag]** `76880a2` Box sync settup guide.
- **[rag]** `d0d890f` Review and stabilize Supabase RAG app

### 2026-11-16
- **[pulse360]** `fa4718f` feat(rag): add shared auth tiers and update documentation

### 2026-11-15
- **[pulse360]** `a91e07a` docs(rag): mark sub-task 0 done and note ragas as an offline cross-check
- **[pulse360]** `90928eb` feat(rag): add cold-start warm endpoint and evaluation tuning plan
- **[rag]** `9cb07fc` test(api): keep CORS and open-local tests independent of a developer .env
- **[rag]** `ad3369a` feat(prompts): give the FAQ assistant a Pulse360 voice and a support-oriented abstention

### 2026-11-14
- **[rag]** `97201a4` test(config): add overlap-rejection test and isolate test suite from .env
- **[rag]** `529192e` fix(retry): cap total provider retry time at two request timeouts
- **[rag]** `e90850d` fix(upload): cap uploads at 4 MB and explain chunk and OCR rejections
- **[rag]** `82d05fe` feat(api): add authenticated /warm endpoint to wake the database and embedder
- **[rag]** `b665053` fix(api): build the module-level app lazily so a bad .env cannot break imports

### 2026-11-12
- **[rag]** `35911be` updated gitignore

### 2026-11-11
- **[rag]** `62cf6ac` test: pin rate-limit window in the suite; record intermittent-failure investigation
- **[rag]** `089118f` test(api): set https service URLs so the production-mode test does not depend on .env
- **[rag]** `870f237` docs: sync documentation with current code

### 2026-11-10
- **[rag]** `9502fd5` chore(tests): remove stray UTF-8 BOM from test_embeddings.py
- **[rag]** `da0c6cc` test: isolate offline suite from .env and add live OpenAI/pgvector tests
- **[rag]** `808c43f` docs/ci: Box env keys, setup guide and opt-in hourly workflow
- **[rag]** `3658bd5` feat: sync Box files into a Supabase collection
- **[rag]** `f8319d2` feat: accept .docx uploads

### 2026-11-09
- **[pulse360]** `829b8b2` fix(rag): align upload limit with Vercel and set per-call timeouts
- **[pulse360]** `d5b460a` docs(rag): record integration readiness, deploy order and smoke test
- **[pulse360]** `4986592` fix(faq): read visitor IP from trusted proxy hop and rate-limit /api/faq/ask
- **[pulse360]** `6fdbccb` fix(rag): forward visitor IP so the RAG rate limit is per user
- **[pulse360]** `831697d` fix(rag): send separate query key to RAG /ask and /search
- **[rag]** `42d1d5c` fix(llm): send max_completion_tokens to OpenAI so gpt-5.x models work
- **[rag]** `4550fc0` feat(embeddings): add OpenAI embedding provider selectable via EMBEDDING_PROVIDER
- **[rag]** `d5607fc` fix(config): coerce environment values to their declared field types
- **[rag]** `26777a0` fix(api): rate-limit /ask and /search per forwarded visitor IP
- **[rag]** `5772efb` fix(api): require query key and collection allowlist on /ask and /search

### 2026-11-08
- **[pulse360]** `e4db4a9` feat(rag): integrate Pulse360 with companion Supabase RAG service
<!-- ENTRIES:END -->
