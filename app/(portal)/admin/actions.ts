"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkEmbeddable } from "@/lib/embed-check";
import { parseWorkbookBuffer, type ParsedRow, type ParsedTopline, type Warning } from "@/lib/parse-workbook";
import { buildPerf, Perf, type PerfRow } from "@/lib/perf";
import { dataChecks } from "@/lib/checks";
import {
  APPROVAL,
  CHANGE_TYPES,
  CHANNEL_IDS,
  CREATIVE_STATUS,
  LINK_ICONS,
  LIVE_STATUS,
  MARKET_IDS,
  STATUS,
  TARGETING_FIELDS,
  type Role,
} from "@/lib/constants";
import { fmtDate, todayBrisbane } from "@/lib/format";
import { fetchAllPerf } from "@/lib/data";

export type ActionState = { ok?: string; error?: string } | undefined;

// ---------------------------------------------------------------------------
// Guards. RLS enforces the same rules in the database; these give clear errors
// and protect the service-role calls in the Users tab.
// ---------------------------------------------------------------------------
async function requireEditor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You're signed out. Sign in again.");
  const { data: profile } = await supabase.from("profiles").select("role,name,email").eq("id", user.id).single();
  if (!profile || (profile.role !== "editor" && profile.role !== "admin")) throw new Error("Only Sunny editors can do that.");
  return { supabase, user, profile: profile as { role: Role; name: string; email: string } };
}

async function requireAdmin() {
  const ctx = await requireEditor();
  if (ctx.profile.role !== "admin") throw new Error("Only Sunny admins can manage people.");
  return ctx;
}

function done(msg = "Saved"): ActionState {
  revalidatePath("/", "layout");
  return { ok: msg };
}

async function guard(fn: () => Promise<ActionState>): Promise<ActionState> {
  try {
    return await fn();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const oneOf = <T extends readonly string[]>(v: string, list: T, name: string): T[number] => {
  if (!(list as readonly string[]).includes(v)) throw new Error(`Invalid ${name}.`);
  return v as T[number];
};
/** Only http(s) links are stored, so nothing like javascript: can reach an href. */
function url(v: string, label = "Link"): string {
  if (!v) return "";
  try {
    const u = new URL(v);
    if (u.protocol === "https:" || u.protocol === "http:") return u.toString();
  } catch {}
  throw new Error(`${label} must start with https://`);
}
const check = (error: { message: string } | null) => {
  if (error) throw new Error(error.message);
};

// ---------------------------------------------------------------------------
// Quick links
// ---------------------------------------------------------------------------
export async function saveLink(_: ActionState, fd: FormData) {
  return guard(async () => {
    const { supabase } = await requireEditor();
    const row = {
      label: s(fd, "label") || "Untitled link",
      url: url(s(fd, "url")),
      description: s(fd, "description"),
      icon: oneOf(s(fd, "icon") || "link", LINK_ICONS, "icon"),
      sort: Number(s(fd, "sort")) || 0,
    };
    const id = s(fd, "id");
    check(id ? (await supabase.from("links").update(row).eq("id", id)).error : (await supabase.from("links").insert(row)).error);
    return done(id ? "Link saved" : "Link added");
  });
}

export async function deleteLink(_: ActionState, fd: FormData) {
  return guard(async () => {
    const { supabase } = await requireEditor();
    check((await supabase.from("links").delete().eq("id", s(fd, "id"))).error);
    return done("Link removed");
  });
}

// ---------------------------------------------------------------------------
// Channels & targeting
// ---------------------------------------------------------------------------
export async function saveMarketChannel(_: ActionState, fd: FormData) {
  return guard(async () => {
    const { supabase } = await requireEditor();
    const market_id = oneOf(s(fd, "market_id"), MARKET_IDS, "market");
    const channel_id = oneOf(s(fd, "channel_id"), CHANNEL_IDS, "channel");
    const whatagraph_url = url(s(fd, "whatagraph_url"), "Whatagraph link");

    const { data: before } = await supabase
      .from("market_channels")
      .select("whatagraph_url,embed_allowed")
      .eq("market_id", market_id)
      .eq("channel_id", channel_id)
      .maybeSingle();

    // Re-test framing whenever the link changes (or hasn't been tested yet).
    let embed_allowed: boolean | null = before?.embed_allowed ?? null;
    let embedNote = "";
    if (!whatagraph_url) embed_allowed = null;
    else if (whatagraph_url !== before?.whatagraph_url || embed_allowed == null) {
      const r = await checkEmbeddable(whatagraph_url, process.env.NEXT_PUBLIC_SITE_URL || "");
      embed_allowed = r.allowed;
      embedNote = ` ${r.reason}`;
    }
    const row: Record<string, unknown> = {
      market_id,
      channel_id,
      status: oneOf(s(fd, "status"), Object.keys(STATUS) as unknown as readonly string[], "status"),
      whatagraph_url,
      embed_allowed,
      embed: fd.get("embed") === "on" && embed_allowed === true,
      notes: s(fd, "notes"),
    };
    for (const [k] of TARGETING_FIELDS) row[k] = s(fd, k);
    check((await supabase.from("market_channels").upsert(row)).error);
    return done(`Saved.${embedNote}`);
  });
}

export async function saveCreative(_: ActionState, fd: FormData) {
  return guard(async () => {
    const { supabase } = await requireEditor();
    const id = s(fd, "id");
    const market_id = oneOf(s(fd, "market_id"), MARKET_IDS, "market");
    const channel_id = oneOf(s(fd, "channel_id"), CHANNEL_IDS, "channel");
    const row: Record<string, unknown> = {
      market_id,
      channel_id,
      name: s(fd, "name"),
      funnel_stage: s(fd, "funnel_stage"),
      vertical: s(fd, "vertical"),
      message: s(fd, "message"),
      cta: s(fd, "cta"),
      asset_url: url(s(fd, "asset_url"), "Asset link"),
      status: oneOf(s(fd, "status") || "Live", CREATIVE_STATUS, "status"),
    };

    const file = fd.get("asset_file");
    if (file instanceof File && file.size > 0) {
      if (file.size > 4 * 1024 * 1024) throw new Error("Upload files under 4MB, or paste a link to the asset instead.");
      const safe = file.name.replace(/[^\w.-]+/g, "_").slice(-80);
      const path = `${market_id}/${channel_id}/${crypto.randomUUID()}-${safe}`;
      check((await supabase.storage.from("creative-assets").upload(path, file, { contentType: file.type || undefined })).error);
      row.asset_path = path;
    }
    if (fd.get("remove_file") === "on") row.asset_path = null;

    if (id) {
      if ("asset_path" in row) {
        const { data: old } = await supabase.from("creatives").select("asset_path").eq("id", id).single();
        if (old?.asset_path && old.asset_path !== row.asset_path) await supabase.storage.from("creative-assets").remove([old.asset_path]);
      }
      check((await supabase.from("creatives").update(row).eq("id", id)).error);
    } else {
      const { count } = await supabase
        .from("creatives")
        .select("id", { count: "exact", head: true })
        .eq("market_id", market_id)
        .eq("channel_id", channel_id);
      check((await supabase.from("creatives").insert({ ...row, sort: (count ?? 0) + 1 })).error);
    }
    return done(id ? "Creative saved" : "Creative added");
  });
}

export async function deleteCreative(_: ActionState, fd: FormData) {
  return guard(async () => {
    const { supabase } = await requireEditor();
    const id = s(fd, "id");
    const { data: old } = await supabase.from("creatives").select("asset_path").eq("id", id).single();
    check((await supabase.from("creatives").delete().eq("id", id)).error);
    if (old?.asset_path) await supabase.storage.from("creative-assets").remove([old.asset_path]);
    return done("Creative removed");
  });
}

// ---------------------------------------------------------------------------
// What's changed (manual on purpose: it's client-facing copy)
// ---------------------------------------------------------------------------
export async function addChange(_: ActionState, fd: FormData) {
  return guard(async () => {
    const { supabase, user } = await requireEditor();
    const text = s(fd, "text");
    if (!text) throw new Error("Write a sentence or two about what changed.");
    const m = s(fd, "market_id"),
      c = s(fd, "channel_id");
    check(
      (
        await supabase.from("changes").insert({
          date: s(fd, "date") || todayBrisbane(),
          market_id: m === "all" || !m ? null : oneOf(m, MARKET_IDS, "market"),
          channel_id: c === "all" || !c ? null : oneOf(c, CHANNEL_IDS, "channel"),
          type: oneOf(s(fd, "type"), CHANGE_TYPES, "type"),
          text,
          created_by: user.id,
        })
      ).error,
    );
    return done("Update published");
  });
}

export async function deleteChange(_: ActionState, fd: FormData) {
  return guard(async () => {
    const { supabase } = await requireEditor();
    check((await supabase.from("changes").delete().eq("id", s(fd, "id"))).error);
    return done("Update deleted");
  });
}

// ---------------------------------------------------------------------------
// Commentary & notes
// ---------------------------------------------------------------------------
export async function saveMarketText(_: ActionState, fd: FormData) {
  return guard(async () => {
    const { supabase } = await requireEditor();
    const id = oneOf(s(fd, "id"), MARKET_IDS, "market");
    check((await supabase.from("markets").update({ commentary: s(fd, "commentary"), note: s(fd, "note") }).eq("id", id)).error);
    return done();
  });
}

// ---------------------------------------------------------------------------
// Creative tracker
// ---------------------------------------------------------------------------
export async function saveTrackerRow(_: ActionState, fd: FormData) {
  return guard(async () => {
    const { supabase } = await requireEditor();
    const row = {
      generic: s(fd, "generic"),
      legal: s(fd, "legal"),
      finance: s(fd, "finance"),
      real_estate: s(fd, "real_estate"),
      cta: s(fd, "cta"),
      url: url(s(fd, "url"), "Landing page URL"),
      asset_url: url(s(fd, "asset_url"), "Asset link"),
      shared: s(fd, "shared") === "yes",
      approval: oneOf(s(fd, "approval"), APPROVAL, "approval"),
      live_status: oneOf(s(fd, "live_status"), LIVE_STATUS, "live status"),
      feedback: s(fd, "feedback"),
    };
    check((await supabase.from("tracker_rows").update(row).eq("id", s(fd, "id"))).error);
    return done();
  });
}

// ---------------------------------------------------------------------------
// Who's who
// ---------------------------------------------------------------------------
export async function saveTeamMember(_: ActionState, fd: FormData) {
  return guard(async () => {
    const { supabase } = await requireEditor();
    const email = s(fd, "email");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("That email doesn't look right.");
    const row = {
      name: s(fd, "name"),
      role: s(fd, "role"),
      focus: s(fd, "focus"),
      email,
      phone: s(fd, "phone"),
      escalation: fd.get("escalation") === "on",
      sort: Number(s(fd, "sort")) || 0,
    };
    const id = s(fd, "id");
    check(id ? (await supabase.from("team").update(row).eq("id", id)).error : (await supabase.from("team").insert(row)).error);
    return done(id ? "Saved" : "Person added");
  });
}

export async function deleteTeamMember(_: ActionState, fd: FormData) {
  return guard(async () => {
    const { supabase } = await requireEditor();
    check((await supabase.from("team").delete().eq("id", s(fd, "id"))).error);
    return done("Person removed");
  });
}

export async function saveHours(_: ActionState, fd: FormData) {
  return guard(async () => {
    const { supabase } = await requireEditor();
    check((await supabase.from("settings").upsert({ key: "team_hours", value: s(fd, "value") })).error);
    return done();
  });
}

// ---------------------------------------------------------------------------
// Performance data: preview, then commit
// ---------------------------------------------------------------------------
const MEASURES = ["spend", "impressions", "clicks", "leads", "sessions", "sheet_ctr"] as const;
const MEASURE_LABEL: Record<string, string> = {
  spend: "spend",
  impressions: "impressions",
  clicks: "clicks",
  leads: "leads",
  sessions: "sessions",
  sheet_ctr: "sheet CTR",
};
const TOPLINE_KEYS = ["budget_aud", "spend_aud", "spend_pct", "lead_target", "leads_actual", "leads_yoy_pct"] as const;

export interface ImportPreview {
  path: string;
  fileName: string;
  weeks: { date: string; label: string; month: string; state: "new" | "changed" | "same"; cells: number }[];
  lines: string[];
  moreLines: number;
  toplineChanges: number;
  warnings: Warning[];
  unchanged: boolean;
}

const eq = (a: unknown, b: unknown) => (a == null && b == null) || (a != null && b != null && Math.abs(Number(a) - Number(b)) < 1e-9);

async function existingPerf(supabase: Awaited<ReturnType<typeof createClient>>) {
  const all: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("perf_weekly")
      .select("market_id,channel_id,week_start,spend,impressions,clicks,leads,sessions,sheet_ctr")
      .order("week_start")
      .order("market_id")
      .order("channel_id")
      .range(from, from + 999);
    check(error);
    all.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return new Map(all.map((r) => [`${r.market_id}:${r.channel_id}:${r.week_start}`, r]));
}

export async function previewImport(
  _: { preview?: ImportPreview; error?: string } | undefined,
  fd: FormData,
): Promise<{ preview?: ImportPreview; error?: string }> {
  try {
    const { supabase, user } = await requireEditor();
    const file = fd.get("file");
    if (!(file instanceof File) || !file.size) return { error: "Choose the media report .xlsx first." };
    if (!/\.xlsx?$/i.test(file.name)) return { error: "That isn't an Excel file (.xlsx)." };
    if (file.size > 4 * 1024 * 1024) return { error: "That file is over 4MB. Remove unused tabs and try again." };

    const buf = new Uint8Array(await file.arrayBuffer());
    const parsed = await parseWorkbookBuffer(buf);

    // Keep the exact file so the commit imports what was previewed.
    const path = `pending/${user.id}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_").slice(-80)}`;
    check(
      (
        await supabase.storage.from("imports").upload(path, buf, {
          contentType: file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        })
      ).error,
    );

    const existing = await existingPerf(supabase);
    const { data: codes } = await supabase.from("markets").select("id,code,currency");
    const { data: chans } = await supabase.from("channels").select("id,name");
    const code = new Map((codes ?? []).map((m) => [m.id, m]));
    const cname = new Map((chans ?? []).map((c) => [c.id, c.name]));

    const lines: string[] = [];
    const weekState = new Map<string, { changed: number; hadData: boolean }>();
    for (const w of parsed.weeks) weekState.set(w.date, { changed: 0, hadData: false });
    for (const r of parsed.rows) {
      const old = existing.get(`${r.market_id}:${r.channel_id}:${r.week_start}`);
      const ws = weekState.get(r.week_start)!;
      if (old && MEASURES.some((k) => old[k] != null)) ws.hadData = true;
      for (const k of MEASURES) {
        const nv = r[k as keyof ParsedRow] as number | null;
        const ov = (old?.[k] ?? null) as number | null;
        if (eq(nv, ov)) continue;
        ws.changed++;
        const m = code.get(r.market_id);
        const fmt = (v: number | null) =>
          v == null ? "blank" : k === "spend" && m ? new Intl.NumberFormat("en-US", { style: "currency", currency: m.currency }).format(v) : String(v);
        lines.push(`${m?.code ?? r.market_id} ${cname.get(r.channel_id) ?? r.channel_id}, w/c ${fmtDate(r.week_start)}: ${MEASURE_LABEL[k]} ${fmt(ov)} → ${fmt(nv)}`);
      }
    }

    const { data: oldTop } = await supabase.from("perf_topline").select("*");
    const oldTopBy = new Map((oldTop ?? []).map((t) => [String(t.month).slice(0, 10), t]));
    let toplineChanges = 0;
    for (const t of parsed.topline) for (const k of TOPLINE_KEYS) if (!eq(t[k], oldTopBy.get(t.month)?.[k] ?? null)) toplineChanges++;

    const weeks = parsed.weeks.map((w) => {
      const st = weekState.get(w.date)!;
      const hasNew = parsed.rows.some((r) => r.week_start === w.date && MEASURES.some((k) => r[k as keyof ParsedRow] != null));
      return {
        ...w,
        state: (st.changed === 0 ? "same" : !st.hadData && hasNew ? "new" : "changed") as "new" | "changed" | "same",
        cells: st.changed,
      };
    });

    return {
      preview: {
        path,
        fileName: file.name,
        weeks,
        lines: lines.slice(0, 80),
        moreLines: Math.max(0, lines.length - 80),
        toplineChanges,
        warnings: parsed.warnings,
        unchanged: lines.length === 0 && toplineChanges === 0,
      },
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't read that file." };
  }
}

export async function commitImport(path: string, fileName: string): Promise<ActionState> {
  return guard(async () => {
    const { supabase, user } = await requireEditor();
    if (!path.startsWith(`pending/${user.id}/`)) throw new Error("That preview has expired. Upload the file again.");
    const { data: blob, error: dlErr } = await supabase.storage.from("imports").download(path);
    if (dlErr || !blob) throw new Error("That preview has expired. Upload the file again.");
    const parsed = await parseWorkbookBuffer(new Uint8Array(await blob.arrayBuffer()));

    // Move the file out of pending so it's kept with the import record.
    const finalPath = path.replace(/^pending\/[^/]+\//, `${todayBrisbane()}/`);
    const moved = await supabase.storage.from("imports").move(path, finalPath);
    const storagePath = moved.error ? path : finalPath;

    const now = new Date().toISOString();
    const rows = parsed.rows.map((r) => ({ ...r, source_file: fileName, imported_at: now }));
    for (let i = 0; i < rows.length; i += 500) {
      check((await supabase.from("perf_weekly").upsert(rows.slice(i, i + 500), { onConflict: "market_id,channel_id,week_start" })).error);
    }
    if (parsed.topline.length) check((await supabase.from("perf_topline").upsert(parsed.topline as ParsedTopline[])).error);

    // A channel with spend in the sheet that's still marked "Not live" becomes Live.
    const withSpend = new Set(parsed.rows.filter((r) => (r.spend ?? 0) > 0).map((r) => `${r.market_id}:${r.channel_id}`));
    const { data: mcs } = await supabase.from("market_channels").select("market_id,channel_id,status");
    const promote = (mcs ?? []).filter((m) => m.status === "not_live" && withSpend.has(`${m.market_id}:${m.channel_id}`));
    for (const m of promote)
      check((await supabase.from("market_channels").update({ status: "live" }).eq("market_id", m.market_id).eq("channel_id", m.channel_id)).error);

    // Record the import with every data check at this moment.
    const [{ data: perfRows }, { data: markets }, { data: channels }, { data: topline }] = await Promise.all([
      fetchAllPerf(supabase),
      supabase.from("markets").select("id,code").order("sort"),
      supabase.from("channels").select("id,name").order("sort"),
      supabase.from("perf_topline").select("*"),
    ]);
    const perf = new Perf(
      buildPerf((perfRows ?? []) as PerfRow[]),
      (markets ?? []).map((m) => m.id),
      (channels ?? []).map((c) => c.id),
    );
    const warnings = dataChecks({
      perf,
      markets: markets ?? [],
      channels: channels ?? [],
      topline: (topline ?? []).map((t) => ({ ...t, month: String(t.month) })),
      importWarnings: parsed.warnings,
      today: todayBrisbane(),
    });
    check(
      (
        await supabase.from("imports").insert({
          file_name: fileName,
          storage_path: storagePath,
          weeks_imported: perf.weeks().length,
          imported_by: user.id,
          warnings,
        })
      ).error,
    );
    return done(
      `Imported ${perf.weeks().length} weeks from ${fileName}.${promote.length ? ` ${promote.length} channel${promote.length === 1 ? "" : "s"} marked Live.` : ""}`,
    );
  });
}

export async function discardImport(path: string): Promise<ActionState> {
  return guard(async () => {
    const { supabase, user } = await requireEditor();
    if (path.startsWith(`pending/${user.id}/`)) await supabase.storage.from("imports").remove([path]);
    return { ok: "Discarded" };
  });
}

// ---------------------------------------------------------------------------
// Users (admins only). Invite links are generated and copied, like Sunny Sphere,
// rather than emailed: Supabase's own mailer is heavily rate-limited.
// ---------------------------------------------------------------------------
export type InviteState = { ok?: string; error?: string; link?: string } | undefined;

function siteUrl() {
  const u = process.env.NEXT_PUBLIC_SITE_URL;
  if (!u) throw new Error("NEXT_PUBLIC_SITE_URL isn't set in Vercel, so invite links would point to the wrong place.");
  return u.replace(/\/$/, "");
}

export async function inviteUser(_: InviteState, fd: FormData): Promise<InviteState> {
  try {
    await requireAdmin();
    const email = s(fd, "email").toLowerCase();
    const name = s(fd, "name");
    const org = s(fd, "org");
    const role = oneOf(s(fd, "role"), ["viewer", "editor", "admin"] as const, "role");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." };
    if (role !== "viewer" && !email.endsWith("@sunnyadvertising.com.au"))
      return { error: "Editor and admin access is for @sunnyadvertising.com.au addresses only." };

    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.generateLink({
      type: "invite",
      email,
      options: { redirectTo: `${siteUrl()}/invite` },
    });
    if (error) {
      if (/already/i.test(error.message)) return { error: "That email already has an account. Use \"New link\" next to their name instead." };
      return { error: error.message };
    }
    const id = data.user?.id;
    if (id) check((await admin.from("profiles").upsert({ id, email, name: name || email.split("@")[0], org, role })).error);
    revalidatePath("/admin/users");
    return { ok: `Invite link ready for ${email}. It works once and expires in 24 hours.`, link: data.properties?.action_link };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't create the invite." };
  }
}

/** Doubles as "resend invite" and "reset password": both are a recovery link once the user exists. */
export async function newAccessLink(userId: string): Promise<InviteState> {
  try {
    await requireAdmin();
    const admin = createAdminClient();
    const { data: u, error: ue } = await admin.auth.admin.getUserById(userId);
    if (ue || !u.user?.email) return { error: ue?.message || "User not found." };
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: u.user.email,
      options: { redirectTo: `${siteUrl()}/invite` },
    });
    if (error) return { error: error.message };
    return { ok: `Fresh link for ${u.user.email}. It works once and expires in 24 hours.`, link: data.properties?.action_link };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't create a link." };
  }
}

export async function changeRole(_: ActionState, fd: FormData) {
  return guard(async () => {
    const { supabase, user } = await requireAdmin();
    const id = s(fd, "id");
    if (id === user.id) throw new Error("You can't change your own role.");
    const role = oneOf(s(fd, "role"), ["viewer", "editor", "admin"] as const, "role");
    const { data: target } = await supabase.from("profiles").select("email").eq("id", id).single();
    if (role !== "viewer" && !target?.email?.endsWith("@sunnyadvertising.com.au"))
      throw new Error("Editor and admin access is for @sunnyadvertising.com.au addresses only.");
    check((await supabase.from("profiles").update({ role, name: s(fd, "name"), org: s(fd, "org") }).eq("id", id)).error);
    return done("Access updated");
  });
}

/** Revokes access immediately: deleting the auth user ends their sessions and cascades the profile. */
export async function removeUser(_: ActionState, fd: FormData) {
  return guard(async () => {
    const { user } = await requireAdmin();
    const id = s(fd, "id");
    if (id === user.id) throw new Error("You can't remove yourself.");
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.deleteUser(id);
    check(error);
    return done("Access removed");
  });
}
