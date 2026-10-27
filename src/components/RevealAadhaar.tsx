"use client";
import { useActionState } from "react";
import { revealAadhaar } from "@/app/actions/hr";

export default function RevealAadhaar({ id, last4 }: { id: string; last4: string }) {
  const [v, act, pending] = useActionState<string | null, FormData>(revealAadhaar, null);
  return (
    <form action={act} className="row" style={{ gap: 8 }}>
      <input type="hidden" name="id" value={id} />
      <b className="mono" style={{ userSelect: v ? "all" : undefined }}>{v || `•••• •••• ${last4}`}</b>
      {!v && <button className="btn sm" type="submit" disabled={pending}>{pending ? "…" : "Show"}</button>}
    </form>
  );
}
