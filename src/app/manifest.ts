import type { MetadataRoute } from "next";

// Web app manifest — drives the home-screen / install icons on Android & PWA.
// (iOS uses src/app/apple-icon.png; the browser tab favicon uses src/app/icon.png.)
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bracket 26 — Pick the World Cup",
    short_name: "Bracket 26",
    description:
      "Build your 2026 FIFA World Cup bracket. 48 teams, 104 matches, one champion.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
