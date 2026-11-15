import type { NextConfig } from "next";

const dev = process.env.NODE_ENV !== "production";

// Content-Security-Policy for the app. Next.js needs inline scripts for hydration; dev also
// needs eval for fast refresh. Network access is limited to this origin and Supabase.
const appCsp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' https://*.supabase.co wss://*.supabase.co${dev ? " ws://localhost:* http://localhost:*" : ""}`,
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

// The embedded legacy prototype (single bundled HTML) loads MediaPipe models and fonts from
// CDNs, talks to the local Muse bridge and reads public space-weather feeds, so it gets its
// own, wider policy scoped to /legacy only.
const legacyCsp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "media-src 'self' blob: mediastream:",
  "worker-src 'self' blob:",
  "connect-src 'self' ws://localhost:8765 https://cdn.jsdelivr.net https://storage.googleapis.com https://services.swpc.noaa.gov https://api.nasa.gov https://ccmc.gsfc.nasa.gov https://kauai.ccmc.gsfc.nasa.gov",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'self'",
].join("; ");

const common = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" },
    },
  },
  async headers() {
    return [
      {
        source: "/((?!legacy).*)",
        headers: [
          ...common,
          { key: "Content-Security-Policy", value: appCsp },
          // Microphone is needed by the voice assistant; everything else stays off.
          { key: "Permissions-Policy", value: "microphone=(self), camera=(), geolocation=(), payment=(), usb=()" },
        ],
      },
      {
        source: "/legacy/:path*",
        headers: [
          ...common,
          { key: "Content-Security-Policy", value: legacyCsp },
          { key: "Permissions-Policy", value: "microphone=(self), camera=(self), hid=(self), geolocation=(), payment=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
