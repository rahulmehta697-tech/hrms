import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getSettings } from "@/lib/settings";
import { inviteByToken, docsFor, filesOf } from "@/lib/joiners";
import { fd } from "@/lib/dates";
import JoinForm from "@/components/JoinForm";
import Powered from "@/components/Powered";
import { Mark } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Joining form", robots: { index: false, follow: false } };

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { org } = await getSettings();
  const { inv, open } = await inviteByToken(token);
  const head = <div className="jhead"><Mark org={org} /><div><b>{org.name}</b><small>{inv && open ? `Joining form for ${inv.name}` : "Joining form"}</small></div></div>;

  if (!inv || !open) return (
    <div className="jwrap">{head}
      <div className="jbody stack">
        <div className="jmark warn" aria-hidden="true"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg></div>
        <h1>This joining link can&apos;t be opened</h1>
        <p className="muted">Each joining link works for one submission only. This one has already been used, has expired, or was cancelled by HR.</p>
        <div><b>What happens next</b><ul className="jlist">
          <li>If you already submitted, HR has your details. No need to fill it again.</li>
          <li>If HR asked for corrections, they will send you a fresh link.</li>
          <li>If you never filled it, ask HR for a new link.</li></ul></div>
        {(org.hrPhone || org.hrEmail) && <div className="card list"><b>HR office</b>{org.hrPhone && <div><span className="muted">Phone</span><a href={`tel:${org.hrPhone.replace(/\s/g, "")}`}>{org.hrPhone}</a></div>}{org.hrEmail && <div><span className="muted">Email</span><a href={`mailto:${org.hrEmail}`}>{org.hrEmail}</a></div>}</div>}
        <a className="btn" href="/login" style={{ justifyContent: "center" }}>Already an employee? Sign in</a>
      </div>
      <Powered />
    </div>
  );

  if (inv.status === "sent") await db().update(schema.joinerInvites).set({ status: "opened", openedAt: new Date() }).where(eq(schema.joinerInvites.id, inv.id));
  const { aadhaarEnc: _drop, ...data } = inv.data as Record<string, unknown>;
  void _drop;
  return (
    <div className="jwrap">{head}
      <JoinForm token={token} first={inv.name.split(" ")[0]}
        role={{ designation: inv.designation, department: inv.department, joinDate: inv.joinDate ? fd(inv.joinDate) : "", expires: fd(inv.expiresAt.toISOString().slice(0, 10)) }}
        note={inv.status === "corrections" ? inv.note : ""} org={org.name}
        initial={{ fullName: inv.name, mobile: inv.mobile, email: inv.email, ...data }}
        docs={await docsFor(inv.category)} files={await filesOf({ inviteId: inv.id })} />
      <Powered />
    </div>
  );
}
