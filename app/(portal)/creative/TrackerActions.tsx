"use client";

import { useRef, useState, useTransition } from "react";
import { respondToTracker } from "./actions";

export function TrackerActions({ rowId, stage }: { rowId: string; stage: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);

  const run = (decision: "Approved" | "Changes requested") =>
    start(async () => {
      setError(null);
      const res = await respondToTracker(rowId, decision, note);
      if (res.error) setError(res.error);
      else dialog.current?.close();
    });

  return (
    <>
      <div className="row" style={{ marginTop: 8, gap: 6 }}>
        <button className="btn gold sm" type="button" disabled={pending} onClick={() => run("Approved")}>
          Approve
        </button>
        <button className="btn ghost sm" type="button" disabled={pending} onClick={() => {
            setError(null);
            setDialogOpen(true);
            dialog.current?.showModal();
          }}
        >
          Request changes
        </button>
      </div>
      {error && !dialogOpen && <p className="err-msg">{error}</p>}
      <dialog ref={dialog} className="dialog" aria-labelledby={`rc-${rowId}`} onClose={() => setDialogOpen(false)}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run("Changes requested");
          }}
          className="stack"
          style={{ gap: 12 }}
        >
          <h2 id={`rc-${rowId}`}>Request changes</h2>
          <p className="meta" style={{ margin: 0 }}>
            {stage}. Your note goes straight to the Sunny account team.
          </p>
          <label className="f">
            What would you like changed?
            <textarea className="inp" value={note} onChange={(e) => setNote(e.target.value)} required autoFocus />
          </label>
          {error && <p className="err-msg">{error}</p>}
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button className="btn ghost sm" type="button" onClick={() => dialog.current?.close()}>
              Cancel
            </button>
            <button className="btn gold sm" type="submit" disabled={pending || !note.trim()}>
              {pending ? "Sending…" : "Send to the team"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
