import type { MetadataRoute } from "next";

// Manifest PWA — permite instalarea Nitido pe ecranul de start pe telefon,
// cu iconiță și culori de brand, fără magazin de aplicații.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nitido — Marketplace de curățenie",
    short_name: "Nitido",
    description:
      "Postezi o lucrare de curățenie, firmele verificate din zonă primesc alertă instant.",
    start_url: "/",
    display: "standalone",
    background_color: "#142530",
    theme_color: "#17b8a6",
    lang: "ro",
    icons: [
      { src: "/favicon.ico", sizes: "any", type: "image/x-icon" },
    ],
  };
}
