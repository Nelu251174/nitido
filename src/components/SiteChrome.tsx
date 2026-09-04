import Link from "next/link";
import {HomeLogoLink} from "@/components/HomeLogoLink";
import {CITIES} from "@/lib/cities";

export const FOOTER_LINK_GROUPS = [
  { title: "Produs", links: [["Cum funcționează", "/cum-functioneaza"], ["Încredere & Siguranță", "/incredere"], ["Pentru clienți", "/pentru-clienti"], ["Pentru firme", "/pentru-firme"], ["Prețuri", "/preturi"]] },
  { title: "Clienți", links: [["Postează o lucrare", "/signup?role=client"], ["Urmărire live", "/urmarire-live"], ["Siguranță", "/siguranta"]] },
  { title: "Companie", links: [["Despre noi", "/despre-noi"], ["Contact", "/contact"], ["Cariere", "/cariere"]] },
  { title: "Legal", links: [["Termeni", "/termeni"], ["Confidențialitate", "/confidentialitate"], ["Cookie-uri", "/cookie-uri"]] },
] as const;

export function SiteHeader() {
  return <header className="sticky top-0 z-50 h-[66px] border-b border-[#e3e2da] bg-[#f4f3ee]/95 backdrop-blur"><div className="v2-container flex h-full items-center justify-between"><HomeLogoLink/><nav className="v2-hide-mobile flex items-center gap-6 text-sm font-medium text-[#3e4842]"><Link href="/cum-functioneaza">Cum funcționează</Link><Link href="/pentru-clienti">Pentru clienți</Link><Link href="/pentru-firme">Pentru firme</Link><Link href="/preturi">Prețuri</Link><Link href="/despre-noi">Despre noi</Link><Link href="/contact">Contact</Link></nav><div className="flex items-center gap-2"><Link href="/login" className="v2-btn v2-btn-secondary v2-hide-mobile">Autentificare</Link><Link href="/signup" className="v2-btn v2-btn-primary">Înregistrează-te</Link></div></div></header>;
}

export function SiteFooter() {
  return <footer className="bg-[#101711] text-white"><div className="v2-container grid grid-cols-5 gap-8 py-14 v2-mobile-two"><div><Link href="/" className="text-xl font-bold">NITIDO<span className="text-[#39c97c]">.RO</span></Link><p className="mt-4 text-sm leading-6 text-[#8b958f]">Platformă românească pentru conectarea clienților cu firme de curățenie.</p></div>{FOOTER_LINK_GROUPS.map(group=><div key={group.title}><h2 className="text-sm font-bold">{group.title}</h2>{group.links.map(([label,href])=><Link className="mt-3 block text-sm text-[#8b958f] hover:text-white" href={href} key={href}>{label}</Link>)}</div>)}</div><div className="border-t border-[#2a332c]"><div className="v2-container py-6"><h2 className="text-sm font-bold text-white">Curățenie pe orașe</h2><div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">{CITIES.map(c=><Link className="text-sm text-[#8b958f] hover:text-white" href={`/curatenie/${c.slug}`} key={c.slug}>Curățenie {c.name}</Link>)}</div></div></div><div className="border-t border-[#2a332c]"><div className="v2-container flex justify-between py-5 text-xs text-[#8b958f]"><span>© 2026 NITIDO.RO</span><span>0341.402.403 · contact@nitido.ro</span></div></div></footer>;
}
