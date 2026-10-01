import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { exportSheet } from "@/lib/google";
import { parseWorkbookBuffer } from "@/lib/parse-workbook";
import { applyImport, countChanges } from "@/lib/import-apply";
import { todayBrisbane } from "@/lib/format";

/** The "OfficeHQ - Media Report & Tracker 2026" Google Sheet. Override with MEDIA_REPORT_SHEET_ID. */
export const SHEET_ID = process.env.MEDIA_REPORT_SHEET_ID || "1fMU_2rKLnHQ13H2HMIgHecUWjjbwyGFZr_lqQfDsyog";

export interface SyncStatus {
  at: string; // when the sync ran
  ok: boolean;
  message: string;
  changed: boolean;
  sheetModified?: string;
  serviceEmail?: string;
}

/**
 * Pull the media report from Google Sheets and import it if anything changed.
 * Runs hourly (Vercel Cron → /api/cron/sync-sheet) and from "Sync now" in Admin.
 * Uses the service role, because there's no signed-in user on the cron run.
 */
export async function syncFromSheet(triggeredBy: string | null): Promise<SyncStatus> {
  const supabase = createAdminClient();
  let status: SyncStatus;
  try {
    const sheet = await exportSheet(SHEET_ID);
    const parsed = await parseWorkbookBuffer(sheet.buf);
    const diff = await countChanges(supabase, parsed);
    if (diff.cells === 0 && diff.topline === 0) {
      status = { at: new Date().toISOString(), ok: true, changed: false, message: "Checked the sheet. No changes since the last sync.", sheetModified: sheet.modifiedTime, serviceEmail: sheet.serviceEmail };
    } else {
      const path = `sheet-sync/${todayBrisbane()}/${Date.now()}.xlsx`;
      const up = await supabase.storage.from("imports").upload(path, sheet.buf, {
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const res = await applyImport(supabase, parsed, {
        fileName: `${sheet.name} (Google Sheet)`,
        storagePath: up.error ? "" : path,
        importedBy: triggeredBy,
      });
      const n = diff.cells + diff.topline;
      status = {
        at: new Date().toISOString(),
        ok: true,
        changed: true,
        message: `Synced ${n} changed value${n === 1 ? "" : "s"} from the sheet (${res.weeks} weeks with spend).${res.promoted ? ` ${res.promoted} channel${res.promoted === 1 ? "" : "s"} marked Live.` : ""}`,
        sheetModified: sheet.modifiedTime,
        serviceEmail: sheet.serviceEmail,
      };
    }
  } catch (e) {
    status = { at: new Date().toISOString(), ok: false, changed: false, message: e instanceof Error ? e.message : "Sync failed." };
  }
  await supabase.from("settings").upsert({ key: "sheet_sync", value: JSON.stringify(status) });
  return status;
}
