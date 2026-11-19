export const RAG_TOOL_ROLES = ["SYSTEM_ADMIN", "HR_ADMIN"] as const;
export const RAG_MUTATION_ROLES = ["SYSTEM_ADMIN"] as const;

export type RagToolRole = (typeof RAG_TOOL_ROLES)[number];
export type RagMutationRole = (typeof RAG_MUTATION_ROLES)[number];

/**
 * Checks whether a given role is permitted for a specific RAG authorization tier.
 */
export function isRagRoleAllowed(
  role: string | null | undefined,
  allowedRoles: readonly string[] = RAG_TOOL_ROLES,
): boolean {
  if (!role) return false;
  return allowedRoles.includes(role);
}
