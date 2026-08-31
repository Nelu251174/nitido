import Link from "next/link";
import { HomeLogoLink } from "@/components/HomeLogoLink";

export function InfoPageV2({eyebrow,title,intro,children}:{eyebrow:string;title:string;intro:string;children:React.ReactNode}){
  return <main className="min-h-screen bg-[#f4f3ee]"><header className="h-[66px] border-b border-[#e3e2da]"><div className="v2-container h-full flex items-center justify-between"><HomeLogoLink/><div className="flex gap-2"><Link href="/login" className="v2-btn v2-btn-secondary">Autentificare</Link><Link href="/signup" className="v2-btn v2-btn-primary">Înregistrează-te</Link></div></div></header><section className="v2-container py-16"><div className="max-w-3xl"><div className="v2-eyebrow">{eyebrow}</div><h1 className="text-5xl max-sm:text-4xl font-bold tracking-[-.035em] mt-4">{title}</h1><p className="text-lg text-[#5c6660] leading-8 mt-6">{intro}</p></div><div className="grid md:grid-cols-2 gap-5 mt-12">{children}</div><Link href="/" className="v2-btn v2-btn-secondary mt-10">Înapoi la pagina principală</Link></section></main>
}
export function InfoCard({title,children}:{title:string;children:React.ReactNode}){return <article className="v2-card p-6"><h2 className="text-xl font-bold">{title}</h2><div className="text-[#5c6660] leading-7 mt-3">{children}</div></article>}
