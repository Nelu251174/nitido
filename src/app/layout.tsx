import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "@fontsource-variable/instrument-sans";

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
  title: "Nitido — Marketplace de curățenie",
  description: "Postezi o lucrare de curățenie, firmele din zonă primesc alertă instant.",
  openGraph: {
    title: "Nitido — Marketplace de curățenie",
    description: "Postezi o lucrare de curățenie, firmele din zonă primesc alertă instant.",
    url: SITE_URL,
    siteName: "Nitido",
    locale: "ro_RO",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ro" className={`${sora.variable} ${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
