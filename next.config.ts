import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Internal supervised preview; production origins are unaffected.
  allowedDevOrigins: ["terminal.local"],
  // Build lean pentru Docker — copiază doar fișierele necesare la runtime
  // (folosit de Dockerfile-ul din rădăcina proiectului).
  output: "standalone",

  // Account/session responses must not survive logout in an HTTP cache.
  // Apply to errors as well as successful cookie and bearer responses.
  headers() {
    return ["auth", "account", "jobs", "workspace", "recurring", "admin", "payments", "push", "reports", "uploads", "assessments", "firm"].map((area) => ({
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

export default nextConfig;
