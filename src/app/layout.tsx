import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bracket 26 — Pick the World Cup",
  description: "Build your 2026 FIFA World Cup bracket. 48 teams, 32 matches, one champion.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
