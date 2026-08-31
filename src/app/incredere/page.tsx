import { db } from "@/lib/db";
import { getPublicTrustSnapshot } from "@/lib/reviews";
import { SiteFooter,SiteHeader } from "@/components/SiteChrome";
import { VerifiedReviews } from "@/components/VerifiedReviews";
export const dynamic="force-dynamic";
const sections=[
  ["Firme verificate","NITIDO afișează starea de verificare disponibilă în platformă, CUI-ul furnizat, zona de acoperire și starea contului. Nu prezentăm verificări sau certificări care nu au fost efectuate."],
  ["Recenzii verificate","O recenzie verificată poate proveni numai de la clientul unei lucrări NITIDO finalizate corect. Este permisă o singură evaluare pentru relația reală client–job–firmă."],
  ["Dovezi foto obligatorii","Firma încarcă o fotografie la sosire și una la finalizare. Fără dovada finală validă, serverul blochează finalizarea și capturarea plății."],
  ["No-show și responsabilitate","Incidentele confirmate intră în istoricul operațional și pot produce strike-uri sau restricții conform regulilor active ale platformei."],
  ["Plată controlată","Plata folosește autorizare și capturare manuală. Capturarea este solicitată după finalizarea validă; timpul transferului bancar depinde de procesator și bancă."],
  ["Confidențialitatea adresei","Înainte de alocare, firmele văd numai informațiile necesare deciziei. Adresa exactă este disponibilă doar firmei câștigătoare după Accept-ul valid confirmat de server."],
  ["Primul Accept valid","Alocarea este decisă atomic de server. Interfața sau telefonul nu pot atribui aceeași lucrare simultan mai multor firme."],
  ["Suport uman și AI","Asistentul AI oferă explicații, fără autoritate asupra lucrărilor sau plăților. Pentru intervenție umană: 0341.402.403 sau contact@nitido.ro."],
] as const;
export default function TrustPage(){const snapshot=getPublicTrustSnapshot(db);return <main className="bg-[#f4f3ee] text-[#101711]"><SiteHeader/><section className="v2-container py-20 max-md:py-12"><div className="max-w-4xl"><div className="v2-eyebrow">ÎNCREDERE &amp; SIGURANȚĂ</div><h1 className="mt-5 text-[clamp(42px,6vw,72px)] font-bold leading-[1.03] tracking-[-.045em]">Încrederea se construiește prin dovezi, nu prin promisiuni.</h1><p className="mt-7 max-w-3xl text-lg leading-8 text-[#3e4842]">NITIDO combină verificarea firmelor, lucrările reale, dovezile foto, ratingurile și istoricul operațional pentru a crea un marketplace mai transparent pentru clienți și firme.</p></div><div className="mt-16 grid grid-cols-2 gap-5 max-md:grid-cols-1">{sections.map(([title,text],index)=><article className={`rounded-[22px] border border-[#e3e2da] p-7 ${index%3===0?"bg-white":"bg-[#e9f2ec]"}`} key={title}><span className="text-xs font-bold text-[#14663a]">{String(index+1).padStart(2,"0")}</span><h2 className="mt-4 text-2xl font-bold">{title}</h2><p className="mt-4 leading-7 text-[#4d5751]">{text}</p></article>)}</div></section><VerifiedReviews reviews={snapshot.reviews}/><SiteFooter/></main>}
