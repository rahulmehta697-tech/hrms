"use client";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Icon } from "./icons";
import { logout } from "@/app/actions/auth";

export type NavLink = { href: string; label: string; icon: string; badge?: number; match?: string[] };
export type NavGroup = { id: string; label: string; items: NavLink[]; open: boolean };
export type NavData = {
  top: NavLink[];
  groups: NavGroup[];
  bottom: NavLink[];
  org: { name: string; addr: string; logo: string | null; short: string };
  me: { name: string; sub: string; initials: string; admin: boolean };
};

const RAIL_KEY = "hrms.menu.rail", GROUP_KEY = "hrms.menu.groups";
const read = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : d; } catch { return d; } };
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage blocked */ } };

/** The most specific menu entry that matches the current address. */
function activeHref(path: string, links: NavLink[]) {
  let best = "", score = -1;
  for (const l of links) for (const m of [l.href, ...(l.match || [])]) {
    const hit = m === "/" ? path === "/" : path === m || path.startsWith(m.endsWith("/") ? m : m + "/");
    if (hit && m.length > score) { best = l.href; score = m.length; }
  }
  return best;
}

function Logo({ org }: { org: NavData["org"] }) {
  const ini = (org.short || org.name).replace(/[^A-Za-z0-9]/g, "").slice(0, 4).toUpperCase() || "LOGO";
  return <div className={"mark" + (org.logo ? " img" : "")}>{org.logo ? <img src={org.logo} alt="" /> : ini}</div>;
}

export default function Nav({ data }: { data: NavData }) {
  const path = usePathname();
  const all = useMemo(() => [...data.top, ...data.groups.flatMap((g) => g.items), ...data.bottom], [data]);
  const active = activeHref(path, all);
  const activeLabel = all.find((l) => l.href === active)?.label || "Menu";
  const [rail, setRail] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [q, setQ] = useState("");
  const [drawer, setDrawer] = useState(false);

  useEffect(() => { setRail(read(RAIL_KEY, false)); setOpen((o) => ({ ...o, ...read<Record<string, boolean>>(GROUP_KEY, {}) })); }, []);
  useEffect(() => { setDrawer(false); setQ(""); }, [path]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setRail(false); setTimeout(() => (document.getElementById(drawer ? "menu-q-m" : "menu-q") as HTMLInputElement | null)?.focus(), 0); }
      if (e.key === "Escape") setDrawer(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawer]);
  useEffect(() => { document.body.classList.toggle("menu-rail", rail); }, [rail]);

  const toggleRail = () => { const v = !rail; setRail(v); write(RAIL_KEY, v); };
  const toggleGroup = (id: string, now: boolean) => { const v = { ...open, [id]: !now }; setOpen(v); write(GROUP_KEY, v); };
  const ql = q.trim().toLowerCase();
  const fits = (l: NavLink) => !ql || l.label.toLowerCase().includes(ql);
  const anyFits = all.some(fits);

  const Item = ({ l }: { l: NavLink }) => (
    <a href={l.href} className={"nitem" + (l.href === active ? " on" : "")} aria-current={l.href === active ? "page" : undefined} title={rail ? l.label + (l.badge ? ` (${l.badge} waiting)` : "") : undefined}>
      <Icon name={l.icon} />
      <span className="lbl">{l.label}</span>
      {l.badge ? <span className="badge" aria-label={`${l.badge} waiting`}>{l.badge}</span> : null}
    </a>
  );

  const body = (mobile: boolean) => (
    <>
      <div className="sbrand">
        <a className="sorg" href="/"><Logo org={data.org} /><span className="sname"><b>{data.org.name}</b><small>{data.org.addr}</small></span></a>
        {mobile
          ? <button className="iconbtn" type="button" onClick={() => setDrawer(false)} aria-label="Close menu"><Icon name="close" /></button>
          : <button className="iconbtn railbtn" type="button" onClick={toggleRail} aria-label={rail ? "Expand menu" : "Collapse menu"} title={rail ? "Expand menu" : "Collapse menu"} aria-pressed={rail}><Icon name="panel" size={18} /></button>}
      </div>
      <div className="sfind">
        <Icon name="search" size={16} />
        <input id={mobile ? "menu-q-m" : "menu-q"} type="search" placeholder="Find a page" aria-label="Find a page" value={q} onChange={(e) => setQ(e.target.value)} />
        {!mobile && <kbd>Ctrl K</kbd>}
      </div>
      <nav className="snav" aria-label="Main menu">
        {data.top.filter(fits).map((l) => <Item key={l.href} l={l} />)}
        {data.groups.map((g) => {
          const items = g.items.filter(fits);
          if (!items.length) return null;
          const isOpen = rail || !!ql || (open[g.id] ?? (g.open || g.items.some((l) => l.href === active)));
          return (
            <div key={g.id} className="sgroup">
              <div className="sdiv" />
              <button type="button" className="sgrp" aria-expanded={isOpen} aria-controls={`grp-${g.id}${mobile ? "-m" : ""}`} onClick={() => toggleGroup(g.id, isOpen)}>
                <Icon name="chevron" size={14} className={"chev" + (isOpen ? " open" : "")} />{g.label}<span className="cnt">{g.items.length}</span>
              </button>
              {isOpen && <div className="ssub" id={`grp-${g.id}${mobile ? "-m" : ""}`}>{items.map((l) => <Item key={l.href} l={l} />)}</div>}
            </div>
          );
        })}
        {data.bottom.filter(fits).length > 0 && <><div className="sdiv show" />{data.bottom.filter(fits).map((l) => <Item key={l.href} l={l} />)}</>}
        {!anyFits && <p className="sempty">No page called “{q}”.</p>}
      </nav>
      <div className="sme">
        <div className={"avatar" + (data.me.admin ? " adm" : "")} aria-hidden="true">{data.me.initials}</div>
        <div className="swho"><b>{data.me.name}</b><small>{data.me.sub}</small></div>
        <a className="iconbtn" href="/profile" aria-label="Profile and password" title="Profile and password"><Icon name="user" size={18} /></a>
        <form action={logout}><button className="iconbtn" type="submit" aria-label="Sign out" title="Sign out"><Icon name="logout" size={18} /></button></form>
      </div>
    </>
  );

  return (
    <>
      <header className="mbar">
        <button className="iconbtn" type="button" onClick={() => setDrawer(true)} aria-label="Open menu" aria-expanded={drawer}><Icon name="menu" size={22} /></button>
        <Logo org={data.org} />
        <span className="mtitle">{activeLabel}</span>
      </header>
      <aside className={"side" + (rail ? " rail" : "")}>{body(false)}</aside>
      {drawer && (
        <div className="mdrawer" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="mscrim" onClick={() => setDrawer(false)} />
          <aside className="side mside">{body(true)}</aside>
        </div>
      )}
    </>
  );
}
