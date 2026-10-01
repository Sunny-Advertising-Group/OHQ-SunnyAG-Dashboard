"use client";

import { useState, useTransition } from "react";
import { syncSheetNow, type ActionState } from "../actions";

export function SyncNowButton() {
  const [pending, start] = useTransition();
  const [state, setState] = useState<ActionState>(undefined);
  return (
    <div className="row" style={{ gap: 10 }}>
      <button className="btn gold sm" type="button" disabled={pending} onClick={() => start(async () => setState(await syncSheetNow()))}>
        {pending ? "Syncing…" : "Sync now"}
      </button>
      {state?.ok && <span className="ok-msg">{state.ok}</span>}
      {state?.error && <span className="err-msg">{state.error}</span>}
    </div>
  );
}
