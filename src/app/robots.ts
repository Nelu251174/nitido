import {siteIndexingEnabled} from '@/lib/siteIndexing';
export const dynamic='force-dynamic';
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  if(!siteIndexingEnabled())return {rules:{userAgent:'*',disallow:'/'}};
  const siteUrl = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://nitido.ro");
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/pro", "/admin", "/api/", "/client", "/firma", "/login", "/mobile", "/colaborari", "/echipa", "/invitatie", "/remedieri", "/signup", "/reset-parola", "/confirma-email", "/card-finalizat", "/cont$", "/uploads/"],
      },
    ],
    sitemap: new URL("/sitemap.xml",siteUrl).href,
    host: siteUrl.origin,
  };
}
