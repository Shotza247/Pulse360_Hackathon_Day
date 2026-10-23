import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import RagIngestionWorkspace from "@/components/RagIngestionWorkspace";

export const dynamic = "force-dynamic";

export default async function SystemAdminRagPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if ((session.user as any).role !== "SYSTEM_ADMIN") redirect("/dashboard");

  return <RagIngestionWorkspace />;
}
