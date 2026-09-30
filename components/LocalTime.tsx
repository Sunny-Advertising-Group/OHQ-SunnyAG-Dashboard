"use client";

import { useEffect, useState } from "react";

const fmt = (tz: string) =>
  new Intl.DateTimeFormat("en-AU", { timeZone: tz, hour: "numeric", minute: "2-digit", weekday: "short" }).format(new Date());

export function LocalTime({ tz }: { tz: string }) {
  const [t, setT] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => setT(fmt(tz));
    tick();
    const i = setInterval(tick, 30000);
    return () => clearInterval(i);
  }, [tz]);
  return <span suppressHydrationWarning>{t ?? ""}</span>;
}
