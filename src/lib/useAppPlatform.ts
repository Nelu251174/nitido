"use client";

import { Capacitor } from "@capacitor/core";
import { useSyncExternalStore } from "react";

export type AppPlatform = "web" | "ios" | "android" | "unknown";

// The bridge is installed before application JavaScript and stays fixed for
// this document. Keep store promotions absent from SSR and hydration until
// the client identifies its platform, including Capacitor on iPad.
const subscribe = () => () => {};
const serverSnapshot = (): AppPlatform => "unknown";
const clientSnapshot = (): AppPlatform => {
  const platform = Capacitor.getPlatform();
  return platform === "web" || platform === "ios" || platform === "android"
    ? platform
    : "unknown";
};

export function useAppPlatform(): AppPlatform {
  return useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
}
