import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Water Tracker",
    short_name: "Water",
    description: "Daily water intake tracker",
    start_url: "/",
    scope: "/",
    display: "standalone",
    // Splash follows the Ink paper; the title bar takes the icon navy (Squirtle theme).
    background_color: "#f5f5f3",
    theme_color: "#0b3a5c",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
