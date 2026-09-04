import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://nitido.ro";

// Sitemap-ul spune Google exact ce URL-uri publice există. Lipsa lui însemna
// că Google trebuia să „ghicească" structura site-ului — acum o primește
// explicit. Rutele private (client/firmă/admin/login) sunt lăsate afară
// intenționat, în acord cu robots.ts.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes: {
    path: string;
    priority: number;
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  }[] = [
    { path: "", priority: 1.0, changeFrequency: "daily" },
    { path: "/signup", priority: 0.8, changeFrequency: "monthly" },
    { path: "/termeni", priority: 0.3, changeFrequency: "yearly" },
    { path: "/confidentialitate", priority: 0.3, changeFrequency: "yearly" },
    { path: "/cookie-uri", priority: 0.3, changeFrequency: "yearly" },
  ];

  return routes.map((r) => ({
    url: `${SITE_URL}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}
