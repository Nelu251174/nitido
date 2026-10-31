"use client";

import {UiElement,UiText} from '@/components/UiText';
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { CLIENT_NAVIGATION_EVENT, CLIENT_QUICK_NAVIGATION_ITEMS, clientActiveNavigationHref } from "@/lib/clientNavigation";

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
  const activeHref = clientActiveNavigationHref(pathname, hash);

  return (
    <UiElement as="nav" className="mobile-workspace-nav client-mobile-navigation" aria-label="Navigare rapidă">
      {CLIENT_QUICK_NAVIGATION_ITEMS.map(item => (
          <Link key={item.href} href={item.href} aria-current={activeHref === item.href ? "page" : undefined}>
            <span><UiText text={item.label}/></span>
          </Link>
      ))}
    </UiElement>
  );
}
