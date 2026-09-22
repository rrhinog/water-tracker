"use client";

import dynamic from "next/dynamic";

// Client-only: reads localStorage on first render.
const Settings = dynamic(() => import("@/components/Settings"), { ssr: false });

export default function SettingsPage() {
  return <Settings />;
}
