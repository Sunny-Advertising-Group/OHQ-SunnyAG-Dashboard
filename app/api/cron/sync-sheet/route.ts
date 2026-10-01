import { NextResponse } from "next/server";
import { syncFromSheet } from "@/lib/sheet-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Vercel Cron calls this every hour (vercel.json) with "Authorization: Bearer $CRON_SECRET".
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const status = await syncFromSheet(null);
  return NextResponse.json(status, { status: status.ok ? 200 : 500 });
}
