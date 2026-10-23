"use client";
import { usePathname } from "next/navigation";

export type NavItem = { href?: string; label: string; badge?: number; adm?: boolean };

export default function Nav({ items }: { items: NavItem[] }) {
  const p = usePathname();
  const active = (h: string) => (h === "/" ? p === "/" : p === h || p.startsWith(h + "/"));
  return (
    <nav className="rail" aria-label="Modules">
      {items.map((it, i) => it.href
        ? <a key={i} href={it.href} className={it.adm ? "adm" : undefined} aria-current={active(it.href) ? "page" : undefined}>{it.label}{it.badge ? <span className="badge">{it.badge}</span> : null}</a>
        : <div key={i} className="grp">{it.label}</div>)}
    </nav>
  );
}
