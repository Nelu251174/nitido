import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

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
  title: {
    default: "Nitido — Marketplace de curățenie în România",
    template: "%s — Nitido",
  },
  description:
    "Postezi o lucrare de curățenie, firmele verificate din zona ta primesc alertă instant și prima care acceptă o preia. Preț fix afișat de la început, plată securizată prin Stripe.",
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
  applicationName: "Nitido",
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  // Codul de verificare Google Search Console se adaugă aici după ce Nelu
  // revendică proprietatea în GSC (metoda „HTML tag"):
  // verification: { google: "COD_GSC_AICI" },
  openGraph: {
    title: "Nitido — Marketplace de curățenie în România",
    description:
      "Postezi o lucrare de curățenie, firmele verificate din zona ta primesc alertă instant. Preț fix, plată securizată.",
    url: SITE_URL,
    siteName: "Nitido",
    locale: "ro_RO",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Nitido — Marketplace de curățenie în România",
    description:
      "Postezi o lucrare de curățenie, firmele din zonă primesc alertă instant. Preț fix, plată securizată.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ro" className={`${sora.variable} ${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
