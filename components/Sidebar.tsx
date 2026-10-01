"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { initials } from "@/lib/format";

interface NavMarket {
  id: string;
  code: string;
  name: string;
}

export function Shell({
  markets,
  me,
  isEditor,
  children,
}: {
  markets: NavMarket[];
  me: { name: string; org: string; role: string };
  isEditor: boolean;
  children: React.ReactNode;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  // Close the mobile menu on navigation.
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

  const on = (cond: boolean) => (cond ? "on" : undefined);
  const roleLabel = me.role === "admin" ? "Admin" : me.role === "editor" ? "Editor" : "Viewer";

  function toggleTheme() {
    const r = document.documentElement;
    const cur = r.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = cur === "dark" ? "light" : "dark";
    r.dataset.theme = next;
    try {
      localStorage.setItem("ohq_theme", next);
    } catch {}
  }

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
            <b>OfficeHQ</b>
            <small>Media portal · by Sunny</small>
          </div>
        </div>
        <nav className="nav" aria-label="Main">
          <Link href="/" className={on(path === "/")} aria-current={path === "/" ? "page" : undefined}>
            <Icon name="home" />
            Overview
          </Link>
          <Link href="/report" className={on(path.startsWith("/report"))} aria-current={path.startsWith("/report") ? "page" : undefined}>
            <Icon name="sheet" />
            Media report
          </Link>
          <div className="nav-label">Markets</div>
          {markets.map((m) => {
            const active = path.startsWith(`/market/${m.id}`);
            return (
              <Link key={m.id} href={`/market/${m.id}`} className={on(active)} aria-current={active ? "page" : undefined}>
                <span className="code">{m.code}</span>
                {m.name}
              </Link>
            );
          })}
          <div className="nav-label">Working together</div>
          <Link href="/creative" className={on(path.startsWith("/creative"))}>
            <Icon name="creative" />
            Creative tracker
          </Link>
          <Link href="/team" className={on(path.startsWith("/team"))}>
            <Icon name="team" />
            Who&apos;s who
          </Link>
          {isEditor && (
            <>
              <div className="nav-label">Sunny only</div>
              <Link href="/admin" className={on(path.startsWith("/admin"))}>
                <Icon name="admin" />
                Open Admin
              </Link>
            </>
          )}
        </nav>
        <div className="side-foot">
          <div className="who">
            <div className="avatar">{initials(me.name)}</div>
            <div>
              <b>{me.name}</b>
              <small>
                {me.org ? `${me.org} · ` : ""}
                {roleLabel}
              </small>
            </div>
          </div>
          <div className="row" style={{ marginTop: 12, gap: 14 }}>
            <form action="/auth/sign-out" method="post">
              <button className="linkbtn" type="submit">
                Sign out
              </button>
            </form>
            <button className="linkbtn" type="button" onClick={toggleTheme}>
              Toggle theme
            </button>
          </div>
        </div>
      </aside>
      <div style={{ minWidth: 0 }}>
        <div className="topbar">
          <button type="button" onClick={() => setOpen((o) => !o)} aria-label="Open menu" aria-expanded={open} aria-controls="side">
            <Icon name="menu" size={18} strokeWidth={2} />
          </button>
          <b style={{ fontWeight: 700 }}>OfficeHQ media portal</b>
        </div>
        <main id="main" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
