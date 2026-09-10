import type { CapacitorConfig } from "@capacitor/cli";

// Aplicația mobilă NITIDO (Capacitor). Încarcă site-ul live nitido.ro într-un
// shell nativ (App Store / Google Play). Plugin-urile native opționale (splash,
// status bar, push) au fost scoase temporar din cauza unui conflict de versiuni
// Capacitor 8 pe iOS (SPM) — se pot readăuga când e rezolvat upstream. Aplicația
// funcționează integral fără ele: bara de sus e tratată prin CSS (safe-area).
const config: CapacitorConfig = {
  appId: "ro.nitido.app",
  appName: "NITIDO",
  webDir: "mobile-shell",
  server: {
    url: "https://nitido.ro",
    cleartext: false,
  },
  backgroundColor: "#f4f3ee",
};

export default config;
