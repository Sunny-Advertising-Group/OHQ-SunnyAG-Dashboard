import { SheetView } from "@/components/SheetView";
import { Updated } from "@/components/Updated";
import { getCore } from "@/lib/data";
import type { SheetSnapshot } from "@/lib/sheet-grid";
import { REPORT_GID } from "@/lib/sheet-sync";
import { createClient } from "@/lib/supabase/server";

export default async function ReportPage() {
  const supabase = await createClient();
  const [{ markets }, { data }] = await Promise.all([
    getCore(),
    supabase.from("sheet_snapshots").select("title,snapshot,fetched_at,sheet_modified_at").eq("gid", REPORT_GID).maybeSingle(),
  ]);
  const snap = (data?.snapshot as SheetSnapshot | undefined) ?? null;
  const flagged = snap?.rows.some((r) => r.some((c) => c.flag)) ?? false;
  const inSheet = new Set(
    (snap?.rows ?? []).map((r) => /^(OFFICEHQ|RECEPTIONHQ)\s*-\s*([A-Z]{2})/i.exec(r[0]?.t ?? "")?.[2]?.toLowerCase()).filter(Boolean),
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Media report</h1>
          <p className="sub">
            A live copy of the {data?.title ? `“${data.title}” tab of the` : ""} OfficeHQ media report, exactly as it appears in Google Sheets. Refreshed
            every hour.
          </p>
        </div>
        <span className="row" style={{ gap: 12 }}>
          {data?.fetched_at && <Updated at={data.fetched_at} label="Last synced" />}
          {data?.sheet_modified_at && <Updated at={data.sheet_modified_at} label="Sheet edited" />}
        </span>
      </div>
      {snap ? (
        <>
          {inSheet.size > 0 && (
            <nav className="row" style={{ marginBottom: 12 }} aria-label="Jump to market">
              {markets
                .filter((m) => inSheet.has(m.id))
                .map((m) => (
                  <a key={m.id} className="pill" href={`#sheet-${m.id}`}>
                    {m.code}
                  </a>
                ))}
            </nav>
          )}
          <div className="sheet-wrap" tabIndex={0} aria-label={`${snap.title} spreadsheet`}>
            <SheetView snap={snap} />
          </div>
          {flagged && (
            <p className="meta" style={{ marginTop: 10 }}>
              <span className="sheet-flag-key" aria-hidden="true" /> Marked totals add up weekly percentages or costs, so they overstate the real rate.
              Each market page shows these recalculated from totals.
            </p>
          )}
        </>
      ) : (
        <div className="emptybox">
          <b>The media report is being connected</b>Your Sunny team is linking the Google Sheet. It will appear here and refresh every hour.
        </div>
      )}
    </>
  );
}
