import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

// next/font downloads the fonts at build time and self-hosts them: no CDN at runtime (RNF-01).
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const grotesk = Space_Grotesk({ variable: "--font-grotesk", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Doctor's Crew · Astronaut health check",
  applicationName: "Doctor's Crew",
  description: "A 4-minute self-check that tells an astronaut whether they are fit for the day. Prototype with simulated data; not a medical device.",
};
export const viewport: Viewport = { themeColor: "#070B16", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${grotesk.variable} h-full antialiased`}>
      <body className="min-h-full">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
