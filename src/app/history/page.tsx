"use client";

import dynamic from "next/dynamic";

// Client-only: reads localStorage on first render.
const History = dynamic(() => import("@/components/History"), { ssr: false });

export default function HistoryPage() {
  return <History />;
}
