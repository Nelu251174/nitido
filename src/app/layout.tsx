import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "@fontsource-variable/instrument-sans";
import { PwaProvider } from "@/components/PwaProvider";

const sora = localFont({
  src: [
    { path: "./fonts/sora-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/sora-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-sora",
  display: "swap",
});

const inter = localFont({
  src: [
    { path: "./fonts/inter-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/inter-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/inter-600.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-inter",
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://nitido.ro";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: "NITIDO.RO",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "NITIDO",
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192x192.png", type: "image/png", sizes: "192x192" },
      { url: "/icons/icon-512x512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/favicon.ico"],
  },
  title: {
    default: "NITIDO.RO — Marketplace de curățenie în România",
    template: "%s — NITIDO.RO",
  },
  description:
    "Postezi o lucrare de curățenie, firmele verificate din zona ta sunt notificate instant și prima care acceptă o preia. Preț fix afișat de la început, plată securizată.",
  keywords: [
    "curățenie apartament",
    "firme de curățenie",
    "servicii curățenie București",
    "curățenie la domiciliu",
    "curățenie birou",
    "curățenie după constructor",
    "marketplace curățenie",
    "curățenie la cerere",
  ],
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  // Verificarea Google Search Console se activează setând variabila de mediu
  // GOOGLE_SITE_VERIFICATION (codul „HTML tag" din GSC) — fără schimbare de cod.
  verification: process.env.GOOGLE_SITE_VERIFICATION
    ? { google: process.env.GOOGLE_SITE_VERIFICATION }
    : undefined,
  openGraph: {
    title: "NITIDO.RO — Marketplace de curățenie în România",
    description:
      "Postezi o lucrare de curățenie, firmele verificate din zona ta sunt notificate instant. Preț fix, plată securizată.",
    url: SITE_URL,
    siteName: "NITIDO.RO",
    locale: "ro_RO",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "NITIDO.RO — Marketplace de curățenie în România",
    description:
      "Postezi o lucrare de curățenie, firmele din zonă sunt notificate instant. Preț fix, plată securizată.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ro" className={`${sora.variable} ${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <PwaProvider />
      </body>
    </html>
  );
}
