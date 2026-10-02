// The Whatagraph accounts that feed the portal. A market × channel with no account
// here isn't connected, so it's treated as not live. Connect it in Whatagraph and add
// it here (and to the daily routine) when it goes live.
//
// The daily Claude routine reads these with the Whatagraph connector, sums each
// Sunday–Saturday week, and calls load_whatagraph_weeks() in Supabase.

export interface WgSource {
  market: "au" | "us" | "uk" | "nz";
  channel: "google" | "microsoft" | "meta" | "linkedin" | "chatgpt" | "organic";
  sourceId: number;
  /** What Whatagraph calls the integration. */
  integration: string;
  /** What the portal stores as leads (organic: GA4 key events). */
  leads: string;
}

export const WG_SOURCES: WgSource[] = [
  { market: "au", channel: "google", sourceId: 745938, integration: "Google Ads", leads: "Conversions" },
  { market: "us", channel: "google", sourceId: 745941, integration: "Google Ads", leads: "Conversions" },
  { market: "uk", channel: "google", sourceId: 68466, integration: "Google Ads", leads: "Conversions" },
  { market: "nz", channel: "google", sourceId: 745939, integration: "Google Ads", leads: "Conversions" },
  { market: "au", channel: "microsoft", sourceId: 56732, integration: "Microsoft Ads", leads: "Conversions" },
  { market: "us", channel: "microsoft", sourceId: 117890, integration: "Microsoft Ads", leads: "Conversions" },
  { market: "uk", channel: "microsoft", sourceId: 426095, integration: "Microsoft Ads", leads: "Conversions" },
  { market: "nz", channel: "microsoft", sourceId: 56734, integration: "Microsoft Ads", leads: "Conversions" },
  { market: "au", channel: "meta", sourceId: 793260, integration: "Meta Ads", leads: "Leads" },
  { market: "us", channel: "meta", sourceId: 793261, integration: "Meta Ads", leads: "Leads" },
  { market: "uk", channel: "meta", sourceId: 793262, integration: "Meta Ads", leads: "Leads" },
  { market: "au", channel: "linkedin", sourceId: 797071, integration: "LinkedIn Ads", leads: "Website conversions + lead form leads" },
  { market: "us", channel: "linkedin", sourceId: 797072, integration: "LinkedIn Ads", leads: "Website conversions + lead form leads" },
  { market: "uk", channel: "linkedin", sourceId: 797073, integration: "LinkedIn Ads", leads: "Website conversions + lead form leads" },
  { market: "us", channel: "chatgpt", sourceId: 797070, integration: "OpenAI Ads", leads: "Conversions" },
  { market: "au", channel: "organic", sourceId: 746087, integration: "GA4", leads: "Key events (Organic Search + AI Assistant)" },
  { market: "us", channel: "organic", sourceId: 746088, integration: "GA4", leads: "Key events (Organic Search + AI Assistant)" },
  { market: "uk", channel: "organic", sourceId: 746090, integration: "GA4", leads: "Key events (Organic Search + AI Assistant)" },
  { market: "nz", channel: "organic", sourceId: 746091, integration: "GA4", leads: "Key events (Organic Search + AI Assistant)" },
];

/** settings.whatagraph_sync, written by load_whatagraph_weeks() / whatagraph_sync_failed(). */
export interface WgSyncStatus {
  at: string;
  ok: boolean;
  message?: string;
  from?: string;
  latest_week?: string;
  rows?: number;
  changed?: number;
  removed?: number;
  marked_live?: number;
  marked_not_live?: number;
  note?: string;
}
