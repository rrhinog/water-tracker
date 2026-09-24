import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Inter_Tight } from "next/font/google";
import "./globals.css";
import DisplaySize from "@/components/DisplaySize";
import RegisterSW from "@/components/RegisterSW";
import { displayScript } from "@/lib/display";

// Ink Kit faces, self-hosted by Next at build time (no runtime request to Google).
const sans = Inter_Tight({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-inter-tight", display: "swap" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Water",
  description: "Daily water intake tracker",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Water", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5f3" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0c0c" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: the head script sets the display size on <html> before React hydrates.
    <html lang="en" className={`h-full ${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        {/* Display size (Settings → Display), applied while parsing so a reload never flashes at 100%. */}
        <script dangerouslySetInnerHTML={{ __html: displayScript() }} />
      </head>
      <body className="ink-root min-h-full flex flex-col">
        {children}
        <DisplaySize />
        <RegisterSW />
      </body>
    </html>
  );
}
