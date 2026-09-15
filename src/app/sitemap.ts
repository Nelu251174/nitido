import type { MetadataRoute } from "next";
import {siteIndexingEnabled} from '@/lib/siteIndexing';
import {PUBLIC_SEO_PAGES} from '@/lib/publicSeo';
import {CITIES} from '@/lib/cities';
export const dynamic='force-dynamic';
export default function sitemap(): MetadataRoute.Sitemap {
 if(!siteIndexingEnabled())return [];
 // Only public canonical URLs. Do not invent modification dates on every request.
 return [...Object.keys(PUBLIC_SEO_PAGES),...CITIES.map(c=>`/curatenie/${c.slug}`)]
  .map(path=>({url:new URL(path,'https://nitido.ro').href}));
}
