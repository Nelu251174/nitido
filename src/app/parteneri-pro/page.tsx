import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { PartnerApplyForm } from "@/components/PartnerApplyForm";
import { publicPageMetadata } from "@/lib/publicSeo";

export const metadata = publicPageMetadata("/parteneri-pro");

const cards = [
  ["01", "Firme de curățenie", "Turnover, curățenie recurentă și verificări documentate."],
  ["02", "Textile și consumabile", "Reaprovizionare și pregătire proprietate."],
  ["03", "Intervenții ușoare", "Sanitare, electric, HVAC — doar în limitele pilotului."],
  ["04", "Acces și lockbox", "Proceduri controlate, fără date de acces în public."],
];

export default function ParteneriProPage() {
  return (
    <main className="bg-[#f7f9fc] text-[#111827]">
      <SiteHeader />
      <section className="v2-container py-20 max-md:py-12">
        <p className="v2-eyebrow">Program pilot · Constanța, Mamaia, Mamaia-Sat</p>
        <h1 className="mt-5 max-w-4xl text-[clamp(40px,6vw,68px)] font-bold leading-[1.04] tracking-[-.045em]">
          Lucrări recurente pentru echipe care livrează corect, documentat și la timp.
        </h1>
        <p className="mt-7 max-w-3xl text-lg leading-8 text-[#3e4842]">
          NITIDO Pro alocă lucrări de portofoliu partenerilor verificați. Calendar, instrucțiuni, raportare și facturare stau în același flux. Programul nu garantează volum minim.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a href="#aplica" className="v2-btn v2-btn-primary">Aplică pentru verificare</a>
          <Link href="/pentru-firme" className="v2-btn bg-white text-ink border border-[#e2e8f0]">Marketplace standard</Link>
        </div>
      </section>

      <section className="v2-container pb-8 grid gap-5 md:grid-cols-2">
        {cards.map(([n, t, d]) => (
          <article key={n} className="rounded-[22px] border border-[#e2e8f0] bg-white p-7">
            <div className="text-xs font-bold text-[var(--nitido-brand-dark)]">{n}</div>
            <h2 className="mt-4 text-2xl font-bold">{t}</h2>
            <p className="mt-3 leading-7 text-[#4d5751]">{d}</p>
          </article>
        ))}
      </section>

      <section className="v2-container py-16 grid gap-10 md:grid-cols-[1fr_1fr]">
        <div>
          <p className="v2-eyebrow">Standarde</p>
          <h2 className="mt-3 text-3xl font-bold tracking-[-.03em]">Disciplină operațională, nu doar disponibilitate.</h2>
          <ul className="mt-6 space-y-3 text-[#3e4842] leading-7">
            <li>Confirmare sau refuz rapid al lucrării.</li>
            <li>Checklist și raport, acolo unde fluxul o cere.</li>
            <li>Datele proprietății apar doar după alocare.</li>
            <li>Deviz înainte de costul peste plafon.</li>
          </ul>
        </div>
        <div className="rounded-[22px] bg-[var(--nitido-brand-soft)] p-8 leading-7 text-[#3e4842]">
          Activarea este manuală, pe micro-zonă și categorie. Un partener marketplace poate exista fără a fi Pro. Un partener Pro nu primește lucrări sensibile până la verificare.
        </div>
      </section>

      <section className="v2-container pb-24">
        <PartnerApplyForm />
      </section>
      <SiteFooter />
    </main>
  );
}
