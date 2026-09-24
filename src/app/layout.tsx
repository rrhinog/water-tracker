import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Inter_Tight } from "next/font/google";
import { connection } from "next/server";
import "./globals.css";
import DisplaySize from "@/components/DisplaySize";
import RegisterSW from "@/components/RegisterSW";
import { appEnv, appNames, STAGING_BANNER } from "@/lib/appenv";
import { displayScript } from "@/lib/display";

// Ink Kit faces, self-hosted by Next at build time (no runtime request to Google).
const sans = Inter_Tight({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-inter-tight", display: "swap" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex-mono", display: "swap" });

// APP_ENV comes from the container (docker-compose.yml), so it must be read per request, not baked in
// at build: connection() opts the pages into request-time rendering (bundled docs: environment-variables.md).
async function currentEnv() {
  await connection();
  return appEnv(process.env.APP_ENV);
}

export async function generateMetadata(): Promise<Metadata> {
  // The iPhone home-screen label comes from appleWebApp.title, not the manifest.
  const { title } = appNames(await currentEnv());
  return {
    title,
    description: "Daily water intake tracker",
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, title, statusBarStyle: "default" },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5f3" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0c0c" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const staging = (await currentEnv()) === "staging";
  return (
    // suppressHydrationWarning: the head script sets the display size on <html> before React hydrates.
    <html lang="en" className={`h-full ${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        {/* Display size (Settings → Display), applied while parsing so a reload never flashes at 100%. */}
        <script dangerouslySetInnerHTML={{ __html: displayScript() }} />
      </head>
      <body className="ink-root min-h-full flex flex-col">
        {staging && (
          <>
            {/* Fixed so it never scrolls away; the spacer holds its height so it covers nothing at rest. */}
            <div className="staging-banner" role="note">
              <span className="staging-banner__tag">{STAGING_BANNER.tag}</span>
              <span>{STAGING_BANNER.text}</span>
            </div>
            <div className="staging-spacer" aria-hidden="true" />
          </>
        )}
        {children}
        <DisplaySize />
        <RegisterSW />
      </body>
    </html>
  );
}
