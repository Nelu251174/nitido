export const CLIENT_NAVIGATION_EVENT = "nitido:client-navigation";

export const CLIENT_NAVIGATION_ITEMS = [
  { label: "Acasă", href: "/client", target: "" },
  { label: "Rezervări", href: "/client#sec-lucrari", target: "sec-lucrari" },
  { label: "Mesaje", href: "/client/mesaje", target: null },
  { label: "Cont", href: "/client#sec-cont", target: "sec-cont" },
] as const;

export function isClientDashboardTarget(target: string): boolean {
  return CLIENT_NAVIGATION_ITEMS.some(item => item.target === target);
}
