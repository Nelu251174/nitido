import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
