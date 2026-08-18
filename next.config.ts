import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build lean pentru Docker — copiază doar fișierele necesare la runtime
  // (folosit de Dockerfile-ul din rădăcina proiectului).
  output: "standalone",
};

export default nextConfig;
