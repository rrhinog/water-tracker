"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const TABS = [
  { href: "/", label: "Today", icon: <path d="M12 3c-4 5-7 8.5-7 12a7 7 0 0 0 14 0c0-3.5-3-7-7-12z" /> },
  { href: "/history", label: "History", icon: <path d="M4 20V10M10 20V4M16 20v-8M22 20H2" /> },
  {
    href: "/settings",
    label: "Settings",
    icon: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" />
      </>
    ),
  },
];

/**
 * Page frame in Ink Kit terms. Phone: content over a bottom tab bar. Desktop (lg+): a
 * sidebar with the nav and an optional extra block (the coffee streak on Today).
 */
export default function Shell({ children, aside, syncNote }: { children: ReactNode; aside?: ReactNode; syncNote?: ReactNode }) {
  const path = usePathname();
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <div className="flex min-h-full flex-1 flex-col lg:flex-row">
      <aside className="hidden lg:flex lg:w-60 lg:flex-none lg:flex-col" style={{ background: "var(--ink-white)", borderRight: "2px solid var(--ink-900)" }}>
        <div style={{ padding: "24px 24px 20px", background: "var(--ink-black)", color: "var(--ink-white)" }}>
          <span style={{ font: "800 18px/1 var(--font-sans)", letterSpacing: "-0.03em", textTransform: "uppercase" }}>Water</span>
          <span className="eyebrow" style={{ display: "block", marginTop: 6, color: "var(--ink-300)" }}>Self-hosted tracker</span>
        </div>
        <ul className="ink-list ink-list--nav" style={{ borderTop: 0 }}>
          {TABS.map((t) => (
            <li key={t.href}>
              <Link href={t.href} className={active(t.href) ? "is-active" : ""} aria-current={active(t.href) ? "page" : undefined} style={{ fontSize: 16 }}>
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
        {aside && <div style={{ marginTop: "auto", padding: "16px 24px", borderTop: "2px solid var(--ink-900)" }}>{aside}</div>}
        {syncNote && <div style={{ padding: "12px 24px", borderTop: "2px solid var(--ink-900)" }}>{syncNote}</div>}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex-1 pb-[76px] lg:pb-0">{children}</div>
        <nav className="ink-tabbar fixed inset-x-0 bottom-0 lg:hidden" aria-label="Primary">
          {TABS.map((t) => (
            <Link key={t.href} href={t.href} className={`ink-tab ${active(t.href) ? "is-active" : ""}`} aria-current={active(t.href) ? "page" : undefined}>
              <svg viewBox="0 0 24 24" aria-hidden="true">{t.icon}</svg>
              {t.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
