import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <Sidebar
        role={session.user.role}
        name={session.user.name ?? ""}
        department={session.user.department ?? ""}
      />
      <main className="flex-1 flex flex-col bg-gray-50">
        <div className="flex-1 p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
