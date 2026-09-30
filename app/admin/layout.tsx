import { redirect } from "next/navigation";
import { AdminShell } from "@/components/AdminShell";
import { getMe } from "@/lib/data";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile, isEditor, isAdmin } = await getMe();
  if (!isEditor) redirect("/");
  return (
    <AdminShell me={{ name: profile.name || profile.email, role: profile.role }} isAdmin={isAdmin}>
      {children}
    </AdminShell>
  );
}
