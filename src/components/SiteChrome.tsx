import Link from "next/link";
import {HomeLogoLink} from "@/components/HomeLogoLink";
import {PhoneAppPromo} from "@/components/StoreBadges";
import {HeaderAuthButtons} from "@/components/HeaderAuthButtons";
import {MobileMenu} from "@/components/MobileMenu";
import {CITIES} from "@/lib/cities";

export const FOOTER_LINK_GROUPS = [
  { title: "Produs", links: [["Cum funcționează", "/cum-functioneaza"], ["Încredere & Siguranță", "/incredere"], ["Pentru clienți", "/pentru-clienti"], ["Pentru firme", "/pentru-firme"], ["Înscrie-ți firma", "/inscrie-firma"], ["Prețuri", "/preturi"]] },
  { title: "Clienți", links: [["Postează o lucrare", "/signup?role=client"], ["Urmărire live", "/urmarire-live"], ["Siguranță", "/siguranta"]] },
  { title: "Companie", links: [["Despre noi", "/despre-noi"], ["Contact", "/contact"], ["Cariere", "/cariere"]] },
  { title: "Legal", links: [["Termeni", "/termeni"], ["Confidențialitate", "/confidentialitate"], ["Cookie-uri", "/cookie-uri"]] },
] as const;

export function SiteHeader({home=false}:{home?:boolean}) {
  return <header className={`design-header ${home?'design-header-home':''}`}><div className="design-container design-header-inner"><div><HomeLogoLink/><span className="design-logo-caption">O casă mai curată. O viață mai bună.</span></div><nav className="design-desktop-nav" aria-label="Navigare principală"><Link href="/#servicii">Servicii</Link><Link href="/cum-functioneaza">Cum funcționează</Link><Link href="/pentru-firme">Pentru firme</Link></nav><div className="design-header-actions"><HeaderAuthButtons/><MobileMenu/></div></div></header>;
}

export function SiteFooter() {
  return <footer className="bg-[#111827] text-white"><div className="v2-container grid grid-cols-5 gap-8 py-14 v2-mobile-two"><div><Link href="/" className="text-xl font-bold">NITIDO<span className="text-[#39c97c]">.RO</span></Link><p className="mt-4 text-sm leading-6 text-[#8b958f]">Platformă românească pentru conectarea clienților cu firme de curățenie.</p></div>{FOOTER_LINK_GROUPS.map(group=><div key={group.title}><h2 className="text-sm font-bold">{group.title}</h2>{group.links.map(([label,href])=><Link className="mt-3 block text-sm text-[#8b958f] hover:text-white" href={href} key={href}>{label}</Link>)}</div>)}</div><PhoneAppPromo/><div className="border-t border-[#2a332c]"><div className="v2-container py-6"><h2 className="text-sm font-bold text-white">Curățenie pe orașe</h2><div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">{CITIES.map(c=><Link className="text-sm text-[#8b958f] hover:text-white" href={`/curatenie/${c.slug}`} key={c.slug}>Curățenie {c.name}</Link>)}</div></div></div><div className="border-t border-[#2a332c]"><div className="v2-container flex justify-between py-5 text-xs text-[#8b958f]"><span>© 2026 NITIDO.RO</span><span>0341.402.403 · contact@nitido.ro</span></div></div></footer>;
}
