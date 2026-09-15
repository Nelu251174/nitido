import {siteIndexingEnabled} from '@/lib/siteIndexing';
export const dynamic='force-dynamic';
import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://nitido.ro";

export default function robots(): MetadataRoute.Robots {
  if(!siteIndexingEnabled())return {rules:{userAgent:'*',disallow:'/'}};
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api/", "/client", "/firma", "/login", "/mobile", "/colaborari", "/echipa", "/invitatie", "/remedieri", "/signup", "/reset-parola", "/confirma-email", "/card-finalizat", "/cont$", "/uploads/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
