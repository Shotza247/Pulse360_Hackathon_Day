export const RAG_COLLECTION_ID = "pulse360_faq";

// Keep in sync with the category picker in RagIngestionWorkspace.
export const RAG_CATEGORIES = [
  "platform",
  "pricing",
  "privacy",
  "security",
  "onboarding",
  "analytics",
  "billing",
  "support",
] as const;

export function getRagApiUrl() {
  return process.env.RAG_API_URL?.replace(/\/$/, "") ?? "";
}

/** Default wait for quick calls such as listing documents. */
export const RAG_DEFAULT_TIMEOUT_MS = 30_000;
/**
 * `/ask` makes two upstream calls (embed the question, then the LLM), each allowed the RAG
 * API's `REQUEST_TIMEOUT` (default 30 s). Waiting less than both together would give up
 * while the RAG API is still working and hide its own, more specific error.
 */
export const RAG_ASK_TIMEOUT_MS = 60_000;
/** Preview extracts and chunks a file of up to a few MB. */
export const RAG_PREVIEW_TIMEOUT_MS = 60_000;
/** Commit embeds up to 100 chunks in batches, so it needs the longest wait. */
export const RAG_COMMIT_TIMEOUT_MS = 120_000;

/** True when `callRagApi` gave up waiting, as opposed to the service being unreachable. */
export function isRagTimeout(error: unknown) {
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
}

/**
 * Calls the companion RAG API from the server. Library routes (`/collections/*`)
 * require the admin key; query routes (`/ask`, `/search`) require a separate
 * query key. Each key is sent only to the routes it belongs to. `timeoutMs` bounds
 * the whole call; pick it to match the work the route triggers.
 */
export async function callRagApi(
  path: string,
  init: RequestInit = {},
  timeoutMs = RAG_DEFAULT_TIMEOUT_MS,
) {
  const baseUrl = getRagApiUrl();
  if (!baseUrl) {
    throw new Error("RAG_API_URL is not configured on the Pulse360 server.");
  }

  const headers = new Headers(init.headers);
  const adminKey = process.env.RAG_ADMIN_API_KEY;
  const queryKey = process.env.RAG_QUERY_API_KEY;
  if (adminKey && path.startsWith("/collections")) {
    headers.set("X-API-Key", adminKey);
  } else if (queryKey && (path.startsWith("/ask") || path.startsWith("/search"))) {
    headers.set("X-API-Key", queryKey);
  }

  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
    signal: init.signal ?? AbortSignal.timeout(timeoutMs),
  });
}

export async function forwardRagResponse(response: Response) {
  const text = await response.text();
  let payload: unknown = null;

  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { detail: text || "The RAG service returned an invalid response." };
  }

  return Response.json(payload, { status: response.status });
}
