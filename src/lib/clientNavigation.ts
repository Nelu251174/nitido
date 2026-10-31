export const CLIENT_NAVIGATION_EVENT = "nitido:client-navigation";

export const CLIENT_NAVIGATION_ITEMS = [
  { label: "Acasă", href: "/client", target: "" },
  { label: "Rezervări", href: "/client/rezervari", target: "sec-lucrari" },
  { label: "Locuințe", href: "/client/proprietati", target: null },
  { label: "Mesaje", href: "/client/mesaje", target: null },
  { label: "Plăți", href: "/client/plati", target: "sec-plata" },
  { label: "Cont", href: "/client/cont", target: "sec-cont" },
] as const;

// The full menu contains six destinations; the narrow bottom bar keeps four.
export const CLIENT_QUICK_NAVIGATION_ITEMS = CLIENT_NAVIGATION_ITEMS.filter(
  item => item.href !== "/client/proprietati" && item.href !== "/client/plati",
);

export function clientDashboardTargetHref(target: string): string | null {
  const routes: Record<string, string> = {
    "": "/client",
    "sec-lucrari": "/client/rezervari",
    "sec-plata": "/client/plati",
    "sec-cont": "/client/cont",
    "sec-mesaje": "/client/mesaje",
    "sec-noutati": "/client#optiuni",
  };
  return Object.hasOwn(routes, target) ? routes[target] : null;
}

export function isClientDashboardTarget(target: string): boolean {
  return clientDashboardTargetHref(target) !== null;
}

/** A contextual child belongs to one main section; home never matches all routes. */
export function clientActiveNavigationHref(pathname: string, hash = ""): string | null {
  if (pathname === "/client") {
    if (hash === "#sec-form") return "/client/rezervari";
    return clientDashboardTargetHref(hash.replace(/^#/, ""))?.split("#")[0] ?? "/client";
  }
  const groups: readonly [string, readonly string[]][] = [
    ["/client/rezervari", ["/client/rezervari", "/client/evaluari", "/client/evaluari-lucrari", "/client/beneficiar", "/client/rapoarte", "/client/alerte-disponibilitate", "/client/descrie-prin-poze", "/dosare", "/remedieri"]],
    ["/client/proprietati", ["/client/proprietati", "/client/planul-casei", "/client/rutina", "/client/firme-preferate"]],
    ["/client/mesaje", ["/client/mesaje"]],
    ["/client/plati", ["/client/plati", "/client/plata"]],
    ["/client/cont", ["/client/cont", "/client/setari", "/client/business", "/client/host", "/client/pregatire-oaspeti", "/client/organizatii", "/colaborari", "/echipa"]],
  ];
  return groups.find(([, prefixes]) => prefixes.some(prefix => pathname === prefix || pathname.startsWith(prefix + "/")))?.[0] ?? null;
}
