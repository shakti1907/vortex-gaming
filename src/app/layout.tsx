import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "VORTEX GAMING // BIOMECH OS — System Override",
  description:
    "Biomechanical command nexus for the sixteen-title arcade grid. Sharp telemetry, signed score ledgers and a live operator console — awaiting your override.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Orbitron:wght@500;700;900&family=Rajdhani:wght@500;600;700&display=swap"
        />
        <meta name="theme-color" content="#050508" />
      </head>
      <body className="bg-[#050508] text-slate-200 antialiased">{children}</body>
    </html>
  );
}
