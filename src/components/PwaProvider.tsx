"use client";

import { useEffect, useState } from "react";

// Tip minimal pentru evenimentul de instalare (nu e inca in tipurile standard TS).
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "nitido-install-dismissed";

/**
 * PWA: inregistreaza service worker-ul si afiseaza un banner discret
 * „Instaleaza aplicatia" cand browserul permite (Android / Chrome desktop).
 * Pe iOS instalarea se face manual din Share -> „Add to Home Screen".
 */
export function PwaProvider() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    // 1) Inregistreaza service worker-ul
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    // 2) Prinde evenimentul de instalare
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    } catch {}
    if (dismissed) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", () => setShow(false));
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice.catch(() => {});
    setShow(false);
    setDeferred(null);
  }

  function dismiss() {
    setShow(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
  }

  if (!show) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: "50%",
        bottom: 16,
        transform: "translateX(-50%)",
        zIndex: 60,
        width: "calc(100% - 32px)",
        maxWidth: 420,
        background: "#101711",
        color: "#fff",
        borderRadius: 16,
        padding: "14px 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        boxShadow: "0 12px 40px rgba(16,23,17,.35)",
      }}
      role="dialog"
      aria-label="Instalează aplicația NITIDO"
    >
      <div style={{ flex: 1, fontSize: 14, lineHeight: 1.35 }}>
        <b>Instalează aplicația NITIDO</b>
        <div style={{ color: "#b8c1bb", fontSize: 12.5, marginTop: 2 }}>
          Acces rapid de pe ecranul telefonului, ca o aplicație.
        </div>
      </div>
      <button
        onClick={dismiss}
        style={{ background: "transparent", color: "#8b958f", border: "none", fontSize: 13, cursor: "pointer" }}
      >
        Mai târziu
      </button>
      <button
        onClick={install}
        style={{ background: "#39c97c", color: "#101711", border: "none", fontWeight: 700, fontSize: 13, padding: "9px 16px", borderRadius: 10, cursor: "pointer" }}
      >
        Instalează
      </button>
    </div>
  );
}
