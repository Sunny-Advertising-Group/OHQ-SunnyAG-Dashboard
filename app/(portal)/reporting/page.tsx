import Link from "next/link";
import { SheetView } from "@/components/SheetView";
import { Updated } from "@/components/Updated";
import { getCore, getMe, getTopline } from "@/lib/data";
import { latest, todayBrisbane } from "@/lib/format";
import type { SheetSnapshot } from "@/lib/sheet-grid";
import { REPORT_GID } from "@/lib/sheet-sync";
import { createClient } from "@/lib/supabase/server";
import { RecalculatedReport } from "./Recalculated";

// Two views of the media report:
//  - default: the sheet's layout, filled from Whatagraph data, ratios from totals.
//  - "Google Sheet copy": the sheet tab exactly as it looks, for comparison only.
export default async function ReportingPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  const supabase = await createClient();
  const [{ isEditor }, { markets, perfUpdatedAt }, topline, { data }] = await Promise.all([
    getMe(),
    getCore(),
    getTopline(),
    supabase.from("sheet_snapshots").select("title,snapshot,fetched_at,sheet_modified_at").eq("gid", REPORT_GID).maybeSingle(),
  ]);
  const snap = (data?.snapshot as SheetSnapshot | undefined) ?? null;
  const showSheet = !!snap && view === "sheet";
  const flagged = snap?.rows.some((r) => r.some((c) => c.flag)) ?? false;
  const inSheet = new Set(
    (snap?.rows ?? []).map((r) => /^(OFFICEHQ|RECEPTIONHQ)\s*-\s*([A-Z]{2})/i.exec(r[0]?.t ?? "")?.[2]?.toLowerCase()).filter(Boolean),
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Reporting</h1>
          <p className="sub">
            {showSheet
              ? `A read-only copy of the “${snap!.title}” tab of the OfficeHQ Media Report & Tracker, exactly as it appears in Google Sheets. For comparison only.`
              : "The master media report, week by week, with monthly totals. Numbers come from Whatagraph and update daily."}
          </p>
        </div>
        <span className="row" style={{ gap: 12 }}>
          {showSheet ? (
            <>
              <Updated at={data!.fetched_at} label="Last synced" />
              {data!.sheet_modified_at && <Updated at={data!.sheet_modified_at} label="Sheet edited" />}
            </>
          ) : (
            <Updated at={latest(perfUpdatedAt, ...topline.map((t) => t.updated_at))} />
          )}
          {isEditor && (
            <Link className="btn ghost" href="/admin/data">
              Performance data
            </Link>
          )}
        </span>
      </div>

      {snap && (
        <div className="row" style={{ marginBottom: 12, justifyContent: "space-between" }}>
          <nav className="row" aria-label="Report view">
            <Link className={`pill ${showSheet ? "" : "on"}`} href="/reporting">
              Report
            </Link>
            <Link className={`pill ${showSheet ? "on" : ""}`} href="/reporting?view=sheet">
              Google Sheet copy
            </Link>
          </nav>
          {showSheet && inSheet.size > 0 && (
            <nav className="row" aria-label="Jump to market">
              {markets
                .filter((m) => inSheet.has(m.id))
                .map((m) => (
                  <a key={m.id} className="pill" href={`#sheet-${m.id}`}>
                    {m.code}
                  </a>
                ))}
            </nav>
          )}
        </div>
      )}

      {showSheet ? (
        <>
          <div className="sheet-wrap" tabIndex={0} aria-label={`${snap!.title} spreadsheet`}>
            <SheetView snap={snap!} />
          </div>
          {flagged && (
            <p className="meta" style={{ marginTop: 10 }}>
              <span className="sheet-flag-key" aria-hidden="true" /> Marked totals add up weekly percentages or costs, so they overstate the real
              rate. The Report view and each market page work these out from the totals instead.
            </p>
          )}
        </>
      ) : (
        <RecalculatedReport today={todayBrisbane()} />
      )}
    </>
  );
}
