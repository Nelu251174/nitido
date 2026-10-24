import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const nextConfig: NextConfig = {
  // Internal supervised preview; production origins are unaffected.
  allowedDevOrigins: ["terminal.local"],
  // Build lean pentru Docker — copiază doar fișierele necesare la runtime
  // (folosit de Dockerfile-ul din rădăcina proiectului).
  output: "standalone",
  serverExternalPackages: ['geoip-country'],
  // The metadata route reads these local fonts at runtime; keep both in Docker.
  outputFileTracingIncludes: {
    '/*': ['./node_modules/geoip-country/data/**/*','./node_modules/geoip-country/LICENSE','./node_modules/geoip-country/EULA'],
    "/opengraph-image": [
      "./node_modules/@fontsource/inter/files/inter-latin-700-normal.woff",
      "./node_modules/@fontsource/inter/files/inter-latin-ext-700-normal.woff",
    ],
  },

  // Account/session responses must not survive logout in an HTTP cache.
  // Apply to errors as well as successful cookie and bearer responses.
  headers() {
    return ["auth", "account", "jobs", "workspace", "recurring", "admin", "payments", "push", "reports", "uploads", "assessments", "firm", "marketing"].map((area) => ({
      source: `/api/${area}/:path*`,
      headers: [{ key: "Cache-Control", value: "private, no-store" }],
    }));
  },

  // Reduce consumul de RAM la `next build` (serverul de producție e mic, iar
  // build-ul pica pe pasul de generare a paginilor statice — lipsă de memorie).
  // Sursele-map din faza de prerender sunt cel mai mare consumator de memorie.
  enablePrerenderSourceMaps: false,
  productionBrowserSourceMaps: false,
  experimental: {
    webpackMemoryOptimizations: true,
    serverSourceMaps: false,
  },
};

export default createNextIntlPlugin('./src/i18n/request.ts')(nextConfig);
