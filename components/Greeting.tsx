"use client";

import { useSyncExternalStore } from "react";

// Uses the viewer's own clock, so a US client gets "evening" when it's evening for them.
const subscribe = () => () => {};
export function Greeting({ name }: { name: string }) {
  const part = useSyncExternalStore(
    subscribe,
    () => {
      const h = new Date().getHours();
      return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
    },
    () => null,
  );
  return <h1>{part ? `Good ${part}, ${name}` : `Welcome, ${name}`}</h1>;
}
