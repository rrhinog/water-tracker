"use client";

import dynamic from "next/dynamic";

// Client-only: the tracker reads localStorage on first render, which the server cannot do.
const Tracker = dynamic(() => import("@/components/Tracker"), { ssr: false });

export default function Home() {
  return <Tracker />;
}
