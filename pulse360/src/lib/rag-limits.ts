/**
 * Largest FAQ source file the System Admin can upload.
 *
 * Keep this at or below the RAG API's `MAX_BYTES`. That API runs on Vercel, which rejects
 * request bodies above roughly 4.5 MB before the function runs, so a larger limit here
 * would let files through Pulse360 only to fail upstream with an opaque error.
 */
export const RAG_MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export const RAG_MAX_UPLOAD_LABEL = "4 MB";
