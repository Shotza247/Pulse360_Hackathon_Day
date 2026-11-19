import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import RagIngestionWorkspace from "@/components/RagIngestionWorkspace";
import { RAG_MUTATION_ROLES, RAG_TOOL_ROLES, isRagRoleAllowed } from "@/lib/rag-roles";

export const dynamic = "force-dynamic";

export default async function SystemAdminRagPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const role = (session.user as { role?: string }).role;
  if (!isRagRoleAllowed(role, RAG_TOOL_ROLES)) redirect("/dashboard");

  return <RagIngestionWorkspace canManageDocuments={isRagRoleAllowed(role, RAG_MUTATION_ROLES)} />;
}
