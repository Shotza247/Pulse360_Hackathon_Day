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

/**
 * Calls the companion RAG API from the server. Library routes (`/collections/*`)
 * require the admin key; query routes (`/ask`, `/search`) require a separate
 * query key. Each key is sent only to the routes it belongs to.
 */
export async function callRagApi(path: string, init: RequestInit = {}) {
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
    signal: init.signal ?? AbortSignal.timeout(30_000),
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
