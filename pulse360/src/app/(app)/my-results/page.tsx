import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { MyResultsDashboard } from "@/components/MyResultsDashboard";

export const dynamic = "force-dynamic";

export default async function MyResultsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  return <MyResultsDashboard employeeId={Number((session.user as any).id)} />;
}
