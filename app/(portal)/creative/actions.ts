"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { notifyAccountTeam } from "@/lib/notify";

export async function respondToTracker(rowId: string, decision: "Approved" | "Changes requested", note: string) {
  const supabase = await createClient();
  // respond_to_tracker enforces the rules: only from "Awaiting approval", only to
  // Approved / Changes requested, and it writes the "What's changed" entry on approve.
  const { data, error } = await supabase.rpc("respond_to_tracker", { p_row: rowId, p_decision: decision, p_note: note });
  if (error) return { error: error.message };

  if (decision === "Changes requested") {
    const [{ data: me }, { data: team }] = await Promise.all([
      supabase.auth.getUser().then(async ({ data: u }) => supabase.from("profiles").select("name,email,org").eq("id", u.user!.id).single()),
      supabase.from("team").select("email"),
    ]);
    const who = me?.name || me?.email || "The client";
    const site = process.env.NEXT_PUBLIC_SITE_URL || "";
    await notifyAccountTeam(
      `OfficeHQ portal: changes requested on "${data.funnel_stage}"`,
      `${who}${me?.org ? ` (${me.org})` : ""} requested changes to the "${data.funnel_stage}" messaging:\n\n${note}\n\nReview it in Admin → Creative tracker: ${site}/admin/tracker`,
      (team ?? []).map((t) => t.email as string),
    );
  }

  revalidatePath("/creative");
  revalidatePath("/");
  revalidatePath("/admin/tracker");
  return { ok: true };
}
