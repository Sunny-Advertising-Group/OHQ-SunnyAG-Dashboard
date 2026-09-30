import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildPerf, Perf, type PerfRow } from "@/lib/perf";
import type { Role, TargetingKey } from "@/lib/constants";

export interface Market {
  id: string;
  code: string;
  name: string;
  country: string;
  currency: string;
  tz: string;
  tz_label: string;
  note: string;
  commentary: string;
  sort: number;
  updated_at: string;
}
export interface Channel {
  id: string;
  name: string;
  hex: string;
  sort: number;
}
export type MarketChannel = {
  market_id: string;
  channel_id: string;
  status: string;
  whatagraph_url: string;
  embed: boolean;
  embed_allowed: boolean | null;
  notes: string;
  updated_at: string;
  updated_by: string | null;
} & Record<TargetingKey, string>;
export interface Creative {
  id: string;
  market_id: string;
  channel_id: string;
  name: string;
  funnel_stage: string;
  vertical: string;
  message: string;
  cta: string;
  asset_url: string;
  asset_path: string | null;
  status: string;
  sort: number;
  updated_at: string;
  signed_url?: string | null;
}
export interface LinkRow {
  id: string;
  label: string;
  description: string;
  url: string;
  icon: string;
  sort: number;
  updated_at: string;
}
export interface Change {
  id: string;
  date: string;
  market_id: string | null;
  channel_id: string | null;
  type: string;
  text: string;
  created_by: string | null;
  created_at: string;
}
export interface TrackerRow {
  id: string;
  funnel_stage: string;
  generic: string;
  legal: string;
  finance: string;
  real_estate: string;
  cta: string;
  url: string;
  asset_url: string;
  shared: boolean;
  approval: string;
  live_status: string;
  feedback: string;
  feedback_by: string | null;
  feedback_at: string | null;
  sort: number;
  updated_at: string;
}
export interface TeamMember {
  id: string;
  name: string;
  role: string;
  focus: string;
  email: string;
  phone: string;
  escalation: boolean;
  sort: number;
  updated_at: string;
}
export interface Topline {
  month: string;
  budget_aud: number | null;
  spend_aud: number | null;
  spend_pct: number | null;
  lead_target: number | null;
  leads_actual: number | null;
  leads_yoy_pct: number | null;
  updated_at: string;
}
export interface ImportRow {
  id: string;
  file_name: string;
  storage_path: string;
  weeks_imported: number;
  imported_by: string | null;
  imported_at: string;
  warnings: { severity: "hi" | "md" | "lo"; text: string }[];
}
export interface Profile {
  id: string;
  email: string;
  name: string;
  org: string;
  role: Role;
  created_at: string;
}

const numOrNull = (v: unknown) => (v == null ? null : Number(v));

type Client = Awaited<ReturnType<typeof createClient>>;

/** perf_weekly grows ~28 rows a week; page past PostgREST's 1,000-row cap. */
export async function fetchAllPerf(supabase: Client) {
  const PAGE = 1000;
  const all: PerfRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("perf_weekly")
      .select("market_id,channel_id,week_start,report_month,week_label,spend,impressions,clicks,leads,sessions,sheet_ctr")
      .order("week_start")
      .order("market_id")
      .order("channel_id")
      .range(from, from + PAGE - 1);
    if (error) return { data: null, error };
    all.push(...((data ?? []) as PerfRow[]));
    if (!data || data.length < PAGE) return { data: all, error: null };
  }
}

/** The signed-in person's profile. Redirects to /login if there's no session or no profile. */
export const getMe = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle<Profile>();
  if (!profile) redirect("/login?noaccess=1");
  const isEditor = profile.role === "editor" || profile.role === "admin";
  return { user, profile, isEditor, isAdmin: profile.role === "admin" };
});

/** Everything the shell and most pages need, in one round of parallel queries. */
export const getCore = cache(async () => {
  const supabase = await createClient();
  const [markets, channels, mcs, perfRows, imports] = await Promise.all([
    supabase.from("markets").select("*").order("sort"),
    supabase.from("channels").select("*").order("sort"),
    supabase.from("market_channels").select("*"),
    fetchAllPerf(supabase),
    supabase.from("perf_weekly").select("imported_at,source_file").order("imported_at", { ascending: false }).limit(1),
  ]);
  for (const r of [markets, channels, mcs, perfRows]) if (r.error) throw new Error(r.error.message);

  const M = (markets.data ?? []) as Market[];
  const C = (channels.data ?? []) as Channel[];
  const perf = new Perf(
    buildPerf((perfRows.data ?? []) as PerfRow[]),
    M.map((m) => m.id),
    C.map((c) => c.id),
  );
  const mc = new Map<string, MarketChannel>();
  for (const r of (mcs.data ?? []) as MarketChannel[]) mc.set(`${r.market_id}:${r.channel_id}`, r);

  return {
    markets: M,
    channels: C,
    perf,
    mc: (mid: string, cid: string) => mc.get(`${mid}:${cid}`),
    allMc: [...mc.values()],
    liveChannels: (mid: string) => C.filter((c) => mc.get(`${mid}:${c.id}`)?.status === "live"),
    perfUpdatedAt: (imports.data?.[0]?.imported_at as string | undefined) ?? null,
    perfSource: (imports.data?.[0]?.source_file as string | undefined) ?? "",
  };
});

export const getLinks = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("links").select("*").order("sort").order("updated_at");
  if (error) throw new Error(error.message);
  return (data ?? []) as LinkRow[];
});

export const getChanges = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("changes")
    .select("*")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Change[];
});

export const getTopline = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("perf_topline").select("*").order("month");
  if (error) throw new Error(error.message);
  return (data ?? []).map((t) => ({
    ...t,
    budget_aud: numOrNull(t.budget_aud),
    spend_aud: numOrNull(t.spend_aud),
    spend_pct: numOrNull(t.spend_pct),
    lead_target: numOrNull(t.lead_target),
    leads_actual: numOrNull(t.leads_actual),
    leads_yoy_pct: numOrNull(t.leads_yoy_pct),
  })) as Topline[];
});

export const getTracker = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("tracker_rows").select("*").order("sort");
  if (error) throw new Error(error.message);
  return (data ?? []) as TrackerRow[];
});

export const getTeam = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("team").select("*").order("sort").order("updated_at");
  if (error) throw new Error(error.message);
  return (data ?? []) as TeamMember[];
});

export const getSetting = cache(async (key: string) => {
  const supabase = await createClient();
  const { data } = await supabase.from("settings").select("value,updated_at").eq("key", key).maybeSingle();
  return { value: (data?.value as string | undefined) ?? "", updated_at: (data?.updated_at as string | undefined) ?? null };
});

/** Creatives for one market × channel, with short-lived signed URLs for uploaded assets. */
export async function getCreatives(mid: string, cid: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("creatives")
    .select("*")
    .eq("market_id", mid)
    .eq("channel_id", cid)
    .order("sort")
    .order("updated_at");
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Creative[];
  const paths = rows.map((r) => r.asset_path).filter(Boolean) as string[];
  if (paths.length) {
    const { data: signed } = await supabase.storage.from("creative-assets").createSignedUrls(paths, 60 * 60);
    const byPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
    for (const r of rows) if (r.asset_path) r.signed_url = byPath.get(r.asset_path) ?? null;
  }
  return rows;
}

export const getLatestImport = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.from("imports").select("*").order("imported_at", { ascending: false }).limit(1).maybeSingle();
  return (data as ImportRow | null) ?? null;
});
