"use client";

import { useActionState, useState, useTransition } from "react";
import { commitImport, discardImport, previewImport, type ActionState, type ImportPreview } from "../actions";
import { fmtDate, monthName } from "@/lib/format";

export function ImportPanel() {
  const [state, action, pending] = useActionState(previewImport, undefined);
  const [result, setResult] = useState<ActionState>(undefined);
  const [committing, start] = useTransition();
  const [over, setOver] = useState(false);
  const [fileName, setFileName] = useState("");
  const [handled, setHandled] = useState<string | null>(null);
  const preview: ImportPreview | undefined = state?.preview && state.preview.path !== handled ? state.preview : undefined;

  return (
    <div>
      {/* React resets the file input after the check; the preview holds the uploaded copy. */}
      <form action={action} onSubmit={() => setTimeout(() => setFileName(""), 0)}>
        <label
          className={`dropzone ${over ? "over" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            const input = e.currentTarget.querySelector("input");
            if (input && e.dataTransfer.files[0]) {
              input.files = e.dataTransfer.files;
              setFileName(e.dataTransfer.files[0].name);
            }
          }}
        >
          <input
            type="file"
            name="file"
            accept=".xlsx,.xls"
            className="sr-only"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
          />
          <b style={{ display: "block", fontWeight: 600 }}>{fileName || "Drop the latest “Media Report & Tracker” .xlsx here"}</b>
          <span className="meta">
            {fileName ? "Ready to check." : "or click to choose. The portal reads the Master Report tab."} You&apos;ll see what changes before
            anything is saved.
          </span>
        </label>
        <div className="row mt">
          <button className="btn gold" type="submit" disabled={pending || !fileName}>
            {pending ? "Reading the workbook…" : "Check file"}
          </button>
          {state?.error && <span className="err-msg">{state.error}</span>}
          {result?.ok && <span className="ok-msg">{result.ok}</span>}
          {result?.error && <span className="err-msg">{result.error}</span>}
        </div>
      </form>

      {preview && (
        <div className="panel mt" style={{ background: "var(--bg)" }}>
          <div className="panel-head">
            <h3>Preview: {preview.fileName}</h3>
            <span className="meta">Nothing is saved until you import</span>
          </div>
          {preview.unchanged ? (
            <p className="meta">This file matches what&apos;s already in the portal. Nothing would change.</p>
          ) : (
            <>
              <div className="tbl-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Week of</th>
                      <th>Month</th>
                      <th>Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.weeks
                      .filter((w) => w.state !== "same")
                      .map((w) => (
                        <tr key={w.date}>
                          <td>{fmtDate(w.date)}</td>
                          <td>
                            {monthName(w.month)} {w.label}
                          </td>
                          <td>
                            <span className={`badge ${w.state === "new" ? "st-live" : "st-planned"}`}>{w.state === "new" ? "New week" : "Changed"}</span>{" "}
                            <span className="meta">
                              {w.cells} value{w.cells === 1 ? "" : "s"}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <p className="meta" style={{ margin: "8px 0 0" }}>
                {preview.weeks.filter((w) => w.state === "same").length} weeks unchanged
                {preview.toplineChanges ? ` · ${preview.toplineChanges} topline value${preview.toplineChanges === 1 ? "" : "s"} changed` : ""}
              </p>
              <details className="more mt">
                <summary>
                  Before → after ({preview.lines.length + preview.moreLines} value{preview.lines.length + preview.moreLines === 1 ? "" : "s"})
                </summary>
                <ul className="preview-list">
                  {preview.lines.map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
                  {preview.moreLines > 0 && <li className="meta">…and {preview.moreLines} more</li>}
                </ul>
              </details>
            </>
          )}
          {preview.warnings.length > 0 && (
            <ul className="checks mt">
              {preview.warnings.map((w, i) => (
                <li key={i}>
                  <span className={`sev ${w.severity}`}>{w.severity === "hi" ? "Fix" : w.severity === "md" ? "Check" : "Note"}</span>
                  <span>{w.text}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="row mt">
            <button
              className="btn gold"
              type="button"
              disabled={committing}
              onClick={() =>
                start(async () => {
                  const r = await commitImport(preview.path, preview.fileName);
                  setResult(r);
                  if (r?.ok) {
                    setHandled(preview.path);
                    setFileName("");
                  }
                })
              }
            >
              {committing ? "Importing…" : preview.unchanged ? "Import anyway" : "Import these changes"}
            </button>
            <button
              className="btn ghost"
              type="button"
              disabled={committing}
              onClick={() =>
                start(async () => {
                  await discardImport(preview.path);
                  setHandled(preview.path);
                  setResult({ ok: "Discarded. Nothing was changed." });
                })
              }
            >
              Discard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
