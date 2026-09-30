import { Shell } from "@/components/Sidebar";
import { getCore, getMe } from "@/lib/data";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const [{ profile, isEditor }, { markets }] = await Promise.all([getMe(), getCore()]);
  return (
    <Shell
      markets={markets.map((m) => ({ id: m.id, code: m.code, name: m.name }))}
      me={{ name: profile.name || profile.email, org: profile.org, role: profile.role }}
      isEditor={isEditor}
    >
      {children}
    </Shell>
  );
}
