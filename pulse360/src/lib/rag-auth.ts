import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  RAG_TOOL_ROLES,
  RAG_MUTATION_ROLES,
  isRagRoleAllowed,
  type RagToolRole,
  type RagMutationRole,
} from "./rag-roles";

export {
  RAG_TOOL_ROLES,
  RAG_MUTATION_ROLES,
  isRagRoleAllowed,
  type RagToolRole,
  type RagMutationRole,
};

export interface RagSessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
  department: string;
}

export interface RagSession {
  user: RagSessionUser;
}

/**
 * Validates the user's session and verifies their role against the permitted RAG role list.
 * Two standard authorization tiers are defined:
 * - RAG_TOOL_ROLES: ["SYSTEM_ADMIN", "HR_ADMIN"] (document list, workbench, chat tester, eval tools)
 * - RAG_MUTATION_ROLES: ["SYSTEM_ADMIN"] (upload, preview, commit, delete)
 */
export async function requireRagSession(
  allowedRoles: readonly string[] = RAG_TOOL_ROLES,
): Promise<RagSession | null> {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return null;
  }

  const role = (session.user as { role?: string }).role;
  if (!isRagRoleAllowed(role, allowedRoles)) {
    return null;
  }

  return session as unknown as RagSession;
}
