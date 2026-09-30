"use client";

import { useEffect, useState } from "react";

interface Zone {
  label: string;
  tz: string;
}

// Sunny's working hours in Brisbane time (no daylight saving): 8:30am–5pm, Mon–Fri.
const OPEN_MIN = 8 * 60 + 30;
const CLOSE_MIN = 17 * 60;

function read(tz: string, now: Date) {
  const time = new Intl.DateTimeFormat("en-AU", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(now);
  const day = new Intl.DateTimeFormat("en-AU", { timeZone: tz, weekday: "long" }).format(now);
  const parts = new Intl.DateTimeFormat("en-AU", { timeZone: tz, hour: "numeric", minute: "numeric", weekday: "short", hour12: false }).formatToParts(now);
  const h = +parts.find((p) => p.type === "hour")!.value % 24;
  const m = +parts.find((p) => p.type === "minute")!.value;
  const wd = parts.find((p) => p.type === "weekday")!.value;
  const open = !["Sat", "Sun"].includes(wd) && h * 60 + m >= OPEN_MIN && h * 60 + m < CLOSE_MIN;
  return { time, day, open };
}

export function Clocks({ zones }: { zones: Zone[] }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = setTimeout(tick, 0);
    const i = setInterval(tick, 30000);
    return () => {
      clearTimeout(first);
      clearInterval(i);
    };
  }, []);
  return (
    <div className="clocks">
      {zones.map((z, idx) => {
        const r = now ? read(z.tz, now) : null;
        return (
          <div key={z.tz} className="clock">
            <small>{z.label}</small>
            <b className="num">{r?.time ?? "--:--"}</b>
            <span>{r ? (idx === 0 ? (r.open ? "Online now" : "Outside hours") : r.day) : ""}</span>
          </div>
        );
      })}
    </div>
  );
}
