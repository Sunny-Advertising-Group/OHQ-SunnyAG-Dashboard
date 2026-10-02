import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchSheetTab } from "@/lib/google";
import { buildSnapshot } from "@/lib/sheet-grid";

/** The "OfficeHQ - Media Report & Tracker 2026" Google Sheet. Override with MEDIA_REPORT_SHEET_ID. */
export const SHEET_ID = process.env.MEDIA_REPORT_SHEET_ID || "1fMU_2rKLnHQ13H2HMIgHecUWjjbwyGFZr_lqQfDsyog";

/** The tab shown on the Media report page (the #gid= in the sheet link). Override with MEDIA_REPORT_GID. */
export const REPORT_GID = Number(process.env.MEDIA_REPORT_GID || 157140433);

export interface SyncStatus {
  at: string; // when the sync ran
  ok: boolean;
  message: string;
  changed: boolean;
  sheetModified?: string;
  serviceEmail?: string;
  report?: { ok: boolean; message: string };
}

/** Refresh the formatted copy of the report tab shown on the Media report page. */
async function refreshReportTab(supabase: ReturnType<typeof createAdminClient>, sheetModified?: string) {
  try {
    const { sheet, theme } = await fetchSheetTab(SHEET_ID, REPORT_GID);
    if (!sheet) throw new Error("Google returned no data for that tab.");
    const snap = buildSnapshot(sheet, theme);
    const { error } = await supabase.from("sheet_snapshots").upsert({
      gid: REPORT_GID,
      title: snap.title,
      snapshot: snap,
      fetched_at: new Date().toISOString(),
      sheet_modified_at: sheetModified ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true, message: `Media report tab “${snap.title}” refreshed (${snap.rows.length} rows).` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Couldn't refresh the Media report tab." };
  }
}

/**
 * Refresh the formatted copy of the media report tab (Reporting → "Google Sheet copy").
 * Runs hourly (Vercel Cron → /api/cron/sync-sheet) and from "Refresh now" in Admin.
 * Performance numbers no longer come from the sheet: they're loaded from Whatagraph
 * (see load_whatagraph_weeks). This only keeps the read-only copy of the tab current.
 */
export async function syncFromSheet(): Promise<SyncStatus> {
  const supabase = createAdminClient();
  const report = await refreshReportTab(supabase);
  const status: SyncStatus = { at: new Date().toISOString(), ok: report.ok, changed: false, message: report.message, report };
  await supabase.from("settings").upsert({ key: "sheet_sync", value: JSON.stringify(status) });
  return status;
}
