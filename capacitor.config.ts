import type { CapacitorConfig } from "@capacitor/cli";

// Aplicația mobilă NITIDO (Capacitor). Încarcă site-ul live într-un shell nativ
// și adaugă funcții native reale (splash, status bar, push) — nu un simplu webview.
const config: CapacitorConfig = {
  appId: "ro.nitido.app",
  appName: "NITIDO",
  webDir: "mobile-shell",
  server: {
    url: "https://nitido.ro",
    cleartext: false,
  },
  backgroundColor: "#f4f3ee",
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: "#101711",
      showSpinner: false,
      androidScaleType: "CENTER_CROP",
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#101711",
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
