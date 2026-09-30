export const MARKET_IDS = ["au", "nz", "uk", "us"] as const;
export const CHANNEL_IDS = ["google", "meta", "linkedin", "programmatic", "microsoft", "chatgpt", "organic"] as const;

export type MarketId = (typeof MARKET_IDS)[number];
export type ChannelId = (typeof CHANNEL_IDS)[number];

export const STATUS: Record<string, string> = {
  live: "Live",
  paused: "Paused",
  planned: "Planned",
  not_live: "Not live",
  awaiting: "Awaiting data",
};

export const TARGETING_FIELDS = [
  ["objective", "Objective"],
  ["audiences", "Audiences"],
  ["locations", "Locations"],
  ["keywords", "Keywords / themes"],
  ["exclusions", "Exclusions"],
  ["bidding", "Bid strategy"],
  ["schedule", "Schedule & devices"],
] as const;
export type TargetingKey = (typeof TARGETING_FIELDS)[number][0];

export const VERTICALS = [
  ["generic", "Generic"],
  ["legal", "Legal"],
  ["finance", "Finance"],
  ["real_estate", "Real Estate"],
] as const;

export const FUNNEL = [
  "Upper",
  "Mid",
  "Lower – Retargeting free trials",
  "Lower – Retargeting website",
  "Lower – Retargeting checkout",
  "Lower – Abandoned cart",
];

export const CHANGE_TYPES = ["Creative", "Budget", "Targeting", "Test", "Tracking", "Other"] as const;
export const APPROVAL = ["Not started", "Awaiting approval", "Changes requested", "Approved"] as const;
export const LIVE_STATUS = ["Not live", "Scheduled", "Live", "Paused"] as const;
export const CREATIVE_STATUS = ["Live", "Scheduled", "Paused"] as const;
export const ROLES = [
  ["viewer", "Viewer (client)"],
  ["editor", "Editor (Sunny)"],
  ["admin", "Admin (Sunny)"],
] as const;
export type Role = "viewer" | "editor" | "admin";

export const LINK_ICONS = ["chart", "sheet", "cal", "folder", "link"] as const;

/** Sessions are capped at 8 hours from sign-in, enforced in proxy.ts. */
export const SESSION_MAX_MS = 8 * 60 * 60 * 1000;
