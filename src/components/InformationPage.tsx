import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";

export type InfoSection = { title: string; paragraphs?: string[]; items?: string[] };

export function InformationPage({eyebrow,title,intro,sections,cta}:{eyebrow:string;title:string;intro:string;sections:InfoSection[];cta?:{label:string;href:string}}) {
  return <main className="bg-[#f4f3ee] text-[#101711]"><SiteHeader/><section className="v2-container py-20 max-md:py-12"><div className="max-w-4xl"><div className="v2-eyebrow">{eyebrow}</div><h1 className="mt-5 text-[clamp(42px,6vw,72px)] font-bold leading-[1.03] tracking-[-.045em]">{title}</h1><p className="mt-7 max-w-3xl text-lg leading-8 text-[#3e4842]">{intro}</p>{cta&&<Link href={cta.href} className="v2-btn v2-btn-primary mt-8">{cta.label}</Link>}</div><div className="mt-16 grid grid-cols-2 items-start gap-5 max-md:grid-cols-1">{sections.map((section,index)=><article key={section.title} className={`rounded-[22px] border border-[#e3e2da] p-7 ${index%3===0?"bg-white":"bg-[#e9f2ec]"}`}><div className="text-xs font-bold text-[#14663a]">{String(index+1).padStart(2,"0")}</div><h2 className="mt-4 text-2xl font-bold">{section.title}</h2>{section.paragraphs?.map(text=><p className="mt-4 leading-7 text-[#4d5751]" key={text}>{text}</p>)}{section.items&&<ol className="mt-5 space-y-3 text-sm leading-6 text-[#3e4842]">{section.items.map(item=><li className="flex gap-3" key={item}><span className="font-bold text-[#1b8a4c]">✓</span><span>{item}</span></li>)}</ol>}</article>)}</div></section><SiteFooter/></main>;
}
