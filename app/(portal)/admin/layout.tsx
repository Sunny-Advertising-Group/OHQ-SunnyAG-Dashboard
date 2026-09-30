import { redirect } from "next/navigation";
import { AdminNav } from "./AdminNav";
import { getMe } from "@/lib/data";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isEditor, isAdmin } = await getMe();
  if (!isEditor) redirect("/");
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Admin</h1>
          <p className="sub">Only Sunny admins and editors can see this. Saved changes appear to the client straight away.</p>
        </div>
      </div>
      <AdminNav isAdmin={isAdmin} />
      {children}
    </>
  );
}
