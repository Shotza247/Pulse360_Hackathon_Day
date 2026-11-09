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
| 1 | Blocker | Rate limit counts every visitor as one client, because the RAG API sees only the Render server IP. Pulse360 forwards the real end-user IP and the RAG API trusts it only on requests that carry a valid server key. | both | Done (iteration B, committed on branch, not pushed) |
| 2 | Blocker | `/ask` and `/search` are public and accept any `collection_id`, so private collections are readable. Require a server-only query key and an allowlist of collections. | both | Done (iteration A, committed on branch, not pushed) |
| 3 | Warning | Upload limits disagree. Both sides advertise 10 MB, Vercel caps request bodies near 4.5 MB (verify against current Vercel docs), and `preview()` rejects documents over 100 chunks. Pick one limit that fits all three. | both | Planned |
| 4 | Warning | Timeouts. Pulse360 aborts after 30 s, while one `/ask` can chain embedding retries and LLM retries, and commit embeds up to 100 chunks in one call. Raise the commit timeout and bound the retries. | both | Planned |
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

- `/api/faq/ask` takes the first valid `X-Forwarded-For` entry (`src/lib/client-ip.ts`) and
  forwards it as `X-Forwarded-Client-IP`. Unit tests: `npm run test:client-ip` (runs in CI).

Known limit: a visitor can prepend their own `X-Forwarded-For` entry, which lets them choose
their own bucket. This cannot lock out other visitors, which was the blocker. A per-IP limit in
the Next.js route (a follow-up, not yet in the table above) would close the remaining gap.
