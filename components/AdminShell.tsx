"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { initials } from "@/lib/format";

type Item = readonly [key: string, label: string, icon: string];
const SECTIONS: { label: string; items: readonly Item[]; adminOnly?: boolean }[] = [
  {
    label: "Content",
    items: [
      ["links", "Quick links", "link"],
      ["channels", "Channels & targeting", "chart"],
      ["changes", "What's changed", "cal"],
      ["commentary", "Commentary & notes", "sheet"],
      ["tracker", "Creative tracker", "creative"],
      ["team", "Who's who", "team"],
    ],
  },
  { label: "Data", items: [["data", "Performance data", "sheet"]] },
  { label: "Access", items: [["users", "People & access", "admin"]], adminOnly: true },
];

/** The Sunny-only admin area: its own layout and menu, separate from the client portal. */
export function AdminShell({
  me,
  isAdmin,
  children,
}: {
  me: { name: string; role: string };
  isAdmin: boolean;
  children: React.ReactNode;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(path);
  if (path !== lastPath) {
    setLastPath(path);
    setOpen(false);
  }
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const current = SECTIONS.flatMap((s) => s.items).find(([k]) => path.startsWith(`/admin/${k}`));

  return (
    <div className="app">
      <a className="skip" href="#main">
        Skip to content
      </a>
      <div className={`side-backdrop ${open ? "open" : ""}`} onClick={() => setOpen(false)} aria-hidden="true" />
      <aside className={`side ${open ? "open" : ""}`} id="side">
        <div className="brand">
          <div className="mark">
            <span />
          </div>
          <div>
            <b>OfficeHQ Admin</b>
            <small>Sunny only</small>
          </div>
        </div>
        <nav className="nav" aria-label="Admin">
          {SECTIONS.filter((s) => !s.adminOnly || isAdmin).map((s) => (
            <div key={s.label}>
              <div className="nav-label">{s.label}</div>
              {s.items.map(([k, l, icon]) => {
                const on = path.startsWith(`/admin/${k}`);
                return (
                  <Link key={k} href={`/admin/${k}`} className={on ? "on" : undefined} aria-current={on ? "page" : undefined}>
                    <Icon name={icon} />
                    {l}
                  </Link>
                );
              })}
            </div>
          ))}
          <div className="nav-label">Client view</div>
          <Link href="/">
            <Icon name="home" />
            Open the client portal
          </Link>
        </nav>
        <div className="side-foot">
          <div className="who">
            <div className="avatar">{initials(me.name)}</div>
            <div>
              <b>{me.name}</b>
              <small>{me.role === "admin" ? "Admin" : "Editor"}</small>
            </div>
          </div>
          <div className="row" style={{ marginTop: 12, gap: 14 }}>
            <form action="/auth/sign-out" method="post">
              <button className="linkbtn" type="submit">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </aside>
      <div style={{ minWidth: 0 }}>
        <div className="topbar">
          <button type="button" onClick={() => setOpen((o) => !o)} aria-label="Open menu" aria-expanded={open} aria-controls="side">
            <Icon name="menu" size={18} strokeWidth={2} />
          </button>
          <b style={{ fontWeight: 700 }}>OfficeHQ Admin</b>
        </div>
        <main id="main" tabIndex={-1}>
          <div className="page-head">
            <div>
              <div className="meta">Admin · Sunny only</div>
              <h1 style={{ marginTop: 4 }}>{current?.[1] ?? "Admin"}</h1>
              <p className="sub">Clients can&apos;t see this area. Saved changes appear in the client portal straight away.</p>
            </div>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
