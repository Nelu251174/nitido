"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";
import {useSyncExternalStore} from "react";
import {Capacitor} from "@capacitor/core";
import {useCurrentUser} from "@/lib/useCurrentUser";
import {DesignIcon, type DesignIconName} from "./DesignIcon";
import {UiElement, UiText} from "./UiText";

const mobileQuery = "(max-width: 760px), (hover: none) and (pointer: coarse)";
function subscribe(listener: () => void) {
  const media = window.matchMedia(mobileQuery);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}
const isMobile = () => Capacitor.isNativePlatform() || window.matchMedia(mobileQuery).matches;
const serverMobile = () => false;

/** The root layout survives public, booking and authentication navigation. */
export function SiteMobileNavigation() {
  const pathname = usePathname();
  const mobile = useSyncExternalStore(subscribe, isMobile, serverMobile);
  // Workspaces and demonstration screens already own their navigation.
  const workspace = ["/client", "/firma", "/admin", "/mobile"].some(
    prefix => pathname === prefix || pathname.startsWith(prefix + "/"),
  );
  if (!mobile || workspace) return null;
  return <PublicNavigation pathname={pathname}/>;
}

function PublicNavigation({pathname}: {pathname: string}) {
  const {user} = useCurrentUser();
  const firm = user?.role === "firma";
  const items: {icon: DesignIconName; label: string; href: string; active: boolean}[] = [
    {icon: "home", label: "Acasă", href: "/", active: pathname === "/"},
    {icon: "calendar", label: user ? "Lucrări" : "Rezervă", href: firm ? "/firma" : user ? "/client/rezervari" : "/rezervare", active: pathname === "/rezervare" || pathname.startsWith("/international/booking")},
    {icon: "chat", label: user ? "Mesaje" : "Ajutor", href: firm ? "/firma/mesaje" : user ? "/client/mesaje" : "/contact", active: pathname === "/contact"},
    {icon: "user", label: "Cont", href: firm ? "/firma" : user ? "/client/cont" : "/login?role=client", active: ["/login", "/signup", "/reset-parola"].includes(pathname)},
  ];
  return <UiElement as="nav" className="design-home-bottom site-mobile-navigation" aria-label="Navigare mobilă">
    {items.map(item => <Link key={item.icon} href={item.href} prefetch={false} aria-current={item.active ? "page" : undefined}>
      <DesignIcon name={item.icon}/><UiText text={item.label}/>
    </Link>)}
  </UiElement>;
}
