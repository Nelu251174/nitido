import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://nitido.ro";

// Fără acest fișier, motoarele de căutare nu primesc niciun semnal despre ce
// pot indexa și unde e sitemap-ul — una dintre cauzele pentru care nimic nu
// era indexat în Google. Rutele de aplicație (autentificate) și API-ul sunt
// blocate; paginile publice de marketing/legal rămân indexabile.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api/", "/client", "/firma", "/login"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
