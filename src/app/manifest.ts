import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NITIDO.RO",
    short_name: "NITIDO",
    description: "Marketplace românesc pentru servicii de curățenie.",
    start_url: "/",
    display: "standalone",
    background_color: "#F4F3EE",
    theme_color: "#1B8A4C",
    icons: [
      {
        src: "/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
