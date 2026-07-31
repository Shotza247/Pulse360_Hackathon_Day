import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const user = session.user as any;

  return (
    <div className="flex min-h-screen">
      <Sidebar
        role={user.role}
        name={user.name ?? ""}
        department={user.department ?? ""}
      />
      <main className="flex-1 flex flex-col bg-gray-50">
        <div className="flex-1 p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
