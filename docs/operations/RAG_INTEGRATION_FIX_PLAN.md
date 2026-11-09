# RAG Integration Fix Plan

Source: integration review of Pulse360 (`Hackathon_Day`) against the companion
[`Supabas_pulse360_RAG`](https://github.com/Shotza247/Supabas_pulse360_RAG) service, reviewed at
Pulse360 `cd64a96` and RAG `84389eb`.

Each fix is delivered as a small iteration: implement, test, code-review, commit. Fixes that touch
both repositories are committed on a matching branch in each (`fix/rag-integration-hardening`) and
are not pushed until reviewed.

## Architecture

```text
Landing chatbot --POST /api/faq/ask--> Pulse360 (Render) --/ask (query key)-----> RAG API (Vercel) --> Supabase pgvector
System Admin UI --/api/system-admin/rag/*--> Pulse360 --/collections/* (admin key)--^
```

The browser never talks to the RAG API. Pulse360 is the only trusted caller.

## Fixes, in order

| # | Severity | Fix | Repo | Status |
|---|----------|-----|------|--------|
| 1 | Blocker | Rate limit counts every visitor as one client, because the RAG API sees only the Render server IP. Pulse360 forwards the real end-user IP and the RAG API trusts it only on requests that carry a valid server key. | both | Done (iterations B and C, pushed on branch, awaiting deploy) |
| 2 | Blocker | `/ask` and `/search` are public and accept any `collection_id`, so private collections are readable. Require a server-only query key and an allowlist of collections. | both | Done (iteration A, pushed on branch, awaiting deploy) |
| 3 | Warning | Upload limits disagree. Both sides advertise 10 MB, Vercel caps request bodies near 4.5 MB (verify against current Vercel docs), and `preview()` rejects documents over 100 chunks. Pick one limit that fits all three. | both | Done (iteration D, committed on branch, awaiting deploy) |
| 4 | Warning | Timeouts. Pulse360 aborts after 30 s, while one `/ask` can chain embedding retries and LLM retries, and commit embeds up to 100 chunks in one call. Raise the commit timeout and bound the retries. | both | Done (iteration D, committed on branch, awaiting deploy) |
| 5 | Warning | Rate limiter opens a database connection and runs DDL plus a cleanup delete on every request. Move DDL to the migration, prune occasionally, and use the Supabase pooler URL. | RAG | Planned |
| 6 | Warning | Supabase schema (`rag.collections`, `documents`, `document_chunks`, `match_document_chunks`) is not defined in either repo. Add numbered migrations so a fresh project can be rebuilt. | RAG | Planned |
| 7 | Warning | Collection `pulse360_faq` must exist before use, and the RAG default collection is `faq_documents`. Add the creation step to the smoke test and align the defaults. | both | Planned |
| 8 | Warning | Library routes return `detail` as a plain string for 401/404/422 and as an object for 503. Make the admin UI handle both. | Pulse360 | Planned |
| 9 | Warning | `already_stored` is always `false` in preview, so duplicates are only found at commit. Compute it in preview. | RAG | Planned |
| 10 | Warning | No way to delete a document from the admin page. | both | Planned |
| 11 | Warning | Anonymous `/ask` responses expose `filename`, `document_id` and `vector_score` in sources. Trim the public fields. | both | Planned |
| 12 | Warning | Category is stored but not used for retrieval. | RAG | Planned |
| 13 | Minor | Remove `/api/mcp/*` routes once no longer needed; reconcile the two LLM key variables. | Pulse360 | Planned |

## Iteration A (fix 2): lock down `/ask` and `/search`

RAG API:

- New env `QUERY_API_KEY`. When set, `/ask` and `/search` require a matching `X-API-Key` header
  (constant-time compare). When unset, the routes are open only if `APP_ENV` is `local`; any other
  `APP_ENV` fails closed with 401.
- New env `PUBLIC_COLLECTIONS` (comma separated). Queries may target only these collections. When
  unset, only the default `COLLECTION` is allowed. Other collections return 403.
- The query key is separate from `ADMIN_API_KEY`, so leaking one does not expose the other.

Pulse360:

- New server-only env `RAG_QUERY_API_KEY`, sent as `X-API-Key` on `/ask` and `/search` only.
- `RAG_ADMIN_API_KEY` stays on `/collections*` only.

Deployment note: set `APP_ENV=production` on Vercel. With the default `APP_ENV=local` and no
`QUERY_API_KEY`, the query routes remain open.

## Iteration B (fix 1): per-visitor rate limit

RAG API:

- `/ask` and `/search` rate-limit by the visitor IP named in the `X-Forwarded-Client-IP`
  header, but only when the caller authenticated with `QUERY_API_KEY`. The value must parse as
  an IP address; otherwise the socket peer is used.
- Requests without a valid query key (open local mode) are always limited by socket peer, so an
  anonymous caller cannot pick their own bucket by rotating the header.

Pulse360:

- `/api/faq/ask` reads the visitor IP and forwards it as `X-Forwarded-Client-IP`
  (`src/lib/client-ip.ts`). Unit tests: `npm run test:client-ip` (runs in CI).

## Iteration C (remaining gap from B): forged `X-Forwarded-For` and no limit on Pulse360

Iteration B took the FIRST `X-Forwarded-For` entry. A visitor can prepend entries of their own,
so they could pick a fresh rate-limit bucket on every request, and Pulse360 itself had no limit.

Pulse360:

- `getClientIp` now reads the entry `TRUSTED_PROXY_HOPS` places from the END of the header
  (default 1, for Render's load balancer). Proxies append to the list, so a client cannot forge
  those entries. Set `TRUSTED_PROXY_HOPS=2` if a CDN such as Cloudflare is added in front.
- `/api/faq/ask` is rate-limited in the Next.js route (`src/lib/rate-limit.ts`): 10 requests per
  minute per visitor IP, plus a global cap of 300 per minute across all visitors. The global cap
  bounds embedding and LLM spend even if the IP cannot be determined or is rotated. Over the limit
  returns 429 with `Retry-After`.

Known limits:

- Counters are in memory, so they are per instance and reset on restart. This fits the single
  Render web service; move them to shared storage before scaling out.
- If `TRUSTED_PROXY_HOPS` is set higher than the real number of proxies, the visitor falls back
  to a null IP and shares the `unknown` bucket. Keep it equal to the real proxy count.

## Iteration D (fixes 3 and 4): upload limits and timeouts

Found while preparing this: `get_settings()` in the RAG API could not load any numeric environment
variable (`REQUEST_TIMEOUT`, `CONTEXT_K`, `CHUNK_CHARS`, ...). It looked field types up as strings, but
`config.py` does not use PEP 563, so the lookup fell back to `str` and `Settings` failed with a
`TypeError` on startup. Any real `.env` with those values would have crashed the API. Fixed with a
regression test, and the RAG tests no longer read a developer's local `.env`.

Upload limits (fix 3):

- One limit everywhere: **4 MB**. Vercel rejects request bodies above roughly 4.5 MB before the
  function runs (verify against current Vercel docs), so the old 10 MB limit failed with a platform
  error. The RAG API (`MAX_BYTES`), the Pulse360 route and the admin UI (`src/lib/rag-limits.ts`) now
  agree.
- `MAX_CHUNKS = 100` is a named constant. Rejections explain themselves: too many chunks reports the
  count and the limit and says to split the file; an empty or scanned document mentions OCR.

Timeouts (fix 4):

- Pulse360 uses a timeout per call instead of one 30 s value: 30 s for listings, 60 s for preview
  and `/ask` (two upstream calls), 120 s for commit (up to 100 chunks in batches of 16). A timeout now
  returns a 504 with a specific message instead of a generic "unavailable".
- The RAG API caps retry waiting. Each provider call previously allowed 3 attempts of the full
  timeout (about 93 s), so one `/ask` could take about 186 s. Retries now share a budget of two
  request timeouts per call.

Known limits:

- Vercel's own function time limit depends on the plan and is not set in `vercel.json`. If commits of
  large documents time out there, set `maxDuration` for `main.py`.
- A commit that times out in Pulse360 may still finish on the RAG side. The admin message says to
  refresh the document list before retrying; commit is idempotent for the same file content.
