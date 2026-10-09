import type { CapacitorConfig } from "@capacitor/cli";

// TestFlight E2 uses an explicit sandbox target; ordinary builds keep the live site.
const serverUrl = process.env.NITIDO_NATIVE_SERVER_URL || 'https://nitido.ro';
if (!['https://nitido.ro', 'https://sandbox.nitido.ro'].includes(serverUrl)) {
  throw new Error('NITIDO_NATIVE_SERVER_URL must be an approved HTTPS origin.');
}
const config: CapacitorConfig = {
  appId: "ro.nitido.app",
  appName: "NITIDO",
  webDir: "mobile-shell",
  server: {
    url: serverUrl,
    cleartext: false,
  },
  backgroundColor: "#f4f3ee",
  plugins: { PushNotifications: { presentationOptions: ['sound', 'banner', 'list'] } },
};

export default config;
