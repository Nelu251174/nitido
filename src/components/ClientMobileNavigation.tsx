"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { CLIENT_NAVIGATION_EVENT, CLIENT_NAVIGATION_ITEMS } from "@/lib/clientNavigation";

function subscribe(listener: () => void) {
  window.addEventListener("hashchange", listener);
  window.addEventListener("popstate", listener);
  window.addEventListener(CLIENT_NAVIGATION_EVENT, listener);
  return () => {
    window.removeEventListener("hashchange", listener);
    window.removeEventListener("popstate", listener);
    window.removeEventListener(CLIENT_NAVIGATION_EVENT, listener);
  };
}

export function ClientMobileNavigation() {
  const pathname = usePathname();
  const hash = useSyncExternalStore(subscribe, () => window.location.hash, () => "");

  return (
    <nav className="mobile-workspace-nav client-mobile-navigation" aria-label="Navigare rapidă">
      {CLIENT_NAVIGATION_ITEMS.map(item => {
        const active = item.target === null
          ? pathname === item.href || pathname.startsWith(`${item.href}/`)
          : pathname === "/client" && hash === (item.target ? `#${item.target}` : "");
        return (
          <Link key={item.label} href={item.href} aria-current={active ? "page" : undefined}
            onClick={event => {
              if (pathname !== "/client" || item.target === null || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              event.preventDefault();
              if (window.location.pathname + window.location.search + window.location.hash !== item.href) {
                window.history.pushState(null, "", item.href);
              }
              // The dashboard restores its sections before scrolling, including repeated taps.
              window.dispatchEvent(new CustomEvent(CLIENT_NAVIGATION_EVENT, { detail: item.target }));
            }}>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
