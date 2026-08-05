import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { NotificationBell } from "@/components/NotificationBell";

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
      <main className="flex-1 flex flex-col bg-gray-50 min-w-0">
        {/* Top bar with notification bell */}
        <div className="flex items-center justify-end gap-2 px-6 py-3 bg-[#0f1f3d] border-b border-white/10">
          <NotificationBell />
        </div>
        <div className="flex-1 p-6 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
