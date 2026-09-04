import type { MetadataRoute } from "next";
import { CITIES } from "@/lib/cities";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://nitido.ro";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticRoutes: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
    { path: "", priority: 1.0, changeFrequency: "daily" },
    { path: "/cum-functioneaza", priority: 0.8, changeFrequency: "monthly" },
    { path: "/pentru-clienti", priority: 0.8, changeFrequency: "monthly" },
    { path: "/pentru-firme", priority: 0.8, changeFrequency: "monthly" },
    { path: "/preturi", priority: 0.8, changeFrequency: "monthly" },
    { path: "/incredere", priority: 0.6, changeFrequency: "monthly" },
    { path: "/siguranta", priority: 0.6, changeFrequency: "monthly" },
    { path: "/urmarire-live", priority: 0.5, changeFrequency: "monthly" },
    { path: "/despre-noi", priority: 0.5, changeFrequency: "monthly" },
    { path: "/contact", priority: 0.5, changeFrequency: "monthly" },
    { path: "/cariere", priority: 0.4, changeFrequency: "monthly" },
    { path: "/signup", priority: 0.8, changeFrequency: "monthly" },
    { path: "/termeni", priority: 0.3, changeFrequency: "yearly" },
    { path: "/confidentialitate", priority: 0.3, changeFrequency: "yearly" },
    { path: "/cookie-uri", priority: 0.3, changeFrequency: "yearly" },
  ];

  const staticEntries: MetadataRoute.Sitemap = staticRoutes.map((r) => ({
    url: `${SITE_URL}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  const cityEntries: MetadataRoute.Sitemap = CITIES.map((c) => ({
    url: `${SITE_URL}/curatenie/${c.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [...staticEntries, ...cityEntries];
}
