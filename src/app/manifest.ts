import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "NITIDO.RO — Marketplace de curățenie",
    short_name: "NITIDO",
    description: "Marketplace românesc pentru servicii de curățenie — postezi o lucrare, firmele verificate din zonă o preiau.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "ro",
    categories: ["business", "productivity", "lifestyle"],
    background_color: "#F4F3EE",
    theme_color: "#1B8A4C",
    icons: [
      { src: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Postează o lucrare", short_name: "Postează", url: "/signup?role=client" },
      { name: "Pentru firme", short_name: "Firme", url: "/signup?role=firma" },
    ],
  };
}
