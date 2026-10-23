export const RAG_COLLECTION_ID = "pulse360_faq";

export function getRagApiUrl() {
  return process.env.RAG_API_URL?.replace(/\/$/, "") ?? "";
}

export async function callRagApi(path: string, init: RequestInit = {}) {
  const baseUrl = getRagApiUrl();
  if (!baseUrl) {
    throw new Error("RAG_API_URL is not configured on the Pulse360 server.");
  }

  return fetch(`${baseUrl}${path}`, {
    ...init,
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
