import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Internal supervised preview; production origins are unaffected.
  allowedDevOrigins: ["terminal.local"],
  // Build lean pentru Docker — copiază doar fișierele necesare la runtime
  // (folosit de Dockerfile-ul din rădăcina proiectului).
  output: "standalone",

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
