"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  ["links", "Quick links"],
  ["channels", "Channels & targeting"],
  ["changes", "What's changed"],
  ["commentary", "Commentary & notes"],
  ["data", "Performance data"],
  ["tracker", "Creative tracker"],
  ["team", "Who's who"],
  ["users", "Users"],
] as const;

export function AdminNav({ isAdmin }: { isAdmin: boolean }) {
  const path = usePathname();
  return (
    <nav className="admin-nav" aria-label="Admin sections">
      {TABS.filter(([k]) => k !== "users" || isAdmin).map(([k, l]) => {
        const on = path.startsWith(`/admin/${k}`);
        return (
          <Link key={k} className={`pill ${on ? "on" : ""}`} href={`/admin/${k}`} aria-current={on ? "page" : undefined}>
            {l}
          </Link>
        );
      })}
    </nav>
  );
}
