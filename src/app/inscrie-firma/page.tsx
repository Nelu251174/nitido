import Link from "next/link";
import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";

export const metadata: Metadata = {
  title: "Înscrie-ți firma de curățenie — București & Constanța | NITIDO.RO",
  description:
    "Firme de curățenie din București și Constanța: primiți lucrări plătite, fără abonament și fără licitație de preț. Înregistrare gratuită, verificare ANAF, plată securizată prin Stripe.",
  alternates: { canonical: "/inscrie-firma" },
};

const VALUE_PROPS: { title: string; text: string }[] = [
  { title: "0 lei la start", text: "Fără abonament, fără taxă de înscriere. Plătești doar comisionul pe lucrările pe care le execuți." },
  { title: "Păstrezi 82% din preț", text: "Comision fix, transparent, de 18%. Restul e al tău — vezi suma netă înainte să accepți." },
  { title: "Clienți reali, cu card", text: "Clientul adaugă cardul înainte de postare. Suma e rezervată la acceptare — muncești în siguranță." },
  { title: "Fără licitație de preț", text: "Prețul e fix, calculat de platformă. Nu te bați pe cel mai mic tarif — te bați pe calitate." },
  { title: "Nitido Quality Index", text: "Reputația ta e construită din lucrări reale: rating, experiență, fiabilitate. Munca bună aduce mai multe lucrări." },
  { title: "Plată securizată Stripe", text: "Încasările trec prin Stripe. Capturarea plății se face după finalizarea confirmată a lucrării." },
];

const STEPS: { n: string; title: string; text: string }[] = [
  { n: "01", title: "Înregistrează firma", text: "Cont de firmă, CUI și zonele de acoperire. Verificăm firma activă prin ANAF." },
  { n: "02", title: "Primești lucrări în zona ta", text: "Alertă la fiecare lucrare din aria declarată. Trimiți ofertă (Standard) sau preiei direct (Express)." },
  { n: "03", title: "Execuți și încasezi", text: "Faci lucrarea, încarci dovada foto la sosire și la final, iar plata se eliberează după confirmare." },
];

const FAQ: { q: string; a: string }[] = [
  { q: "Cât costă înscrierea?", a: "Nimic. Înregistrarea și profilul sunt gratuite. Comisionul de 18% se aplică doar pe lucrările executate." },
  { q: "Cum îmi verificați firma?", a: "Introduci CUI-ul, iar NITIDO încearcă validarea firmei active prin ANAF. Profilul devine „verificat” când sursa confirmă o entitate activă." },
  { q: "Cine îmi vede adresa clientului?", a: "Adresa exactă și fotografiile autorizate se dezvăluie doar firmei căreia i s-a alocat lucrarea — după acceptare." },
  { q: "Când primesc banii?", a: "Suma e rezervată la acceptare și capturată după finalizarea confirmată. Încasările trec prin contul tău Stripe conectat." },
];

export default function InscrieFirmaPage() {
  return (
    <main className="bg-[#f7f9fc] text-[#111827]">
      <SiteHeader />

      {/* Hero */}
      <section className="v2-container py-16 pb-14 max-md:py-12">
        <div className="max-w-3xl">
          <div className="inline-flex rounded-full bg-[#e4f0e8] text-[#115e59] px-4 py-2 text-xs font-bold mb-6">
            Parteneri NITIDO · București &amp; Constanța
          </div>
          <h1 className="text-[56px] max-md:text-[38px] leading-[1.05] tracking-[-.035em] font-bold">
            Firma ta de curățenie primește lucrări plătite. <span className="text-[#0f766e]">Fără abonament.</span>
          </h1>
          <p className="mt-6 text-[17px] leading-7 text-[#3e4842] max-w-2xl">
            NITIDO.RO aduce clienți verificați, cu card salvat, direct în zona ta. Trimiți ofertă sau preiei urgențele
            instant — prețul e fix, tu te concentrezi pe calitate. Lansăm întâi în <b>București</b> și <b>Constanța</b>.
          </p>
          <div className="flex flex-wrap gap-3 mt-8">
            <Link href="/signup?role=firma" className="v2-btn v2-btn-primary">Înregistrează firma gratuit</Link>
            <Link href="/pentru-firme" className="v2-btn v2-btn-secondary">Cum funcționează</Link>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 mt-8 text-sm text-[#64748b]">
            {["Fără taxă de înscriere", "Comision fix 18%", "Verificare ANAF"].map((x) => (
              <span key={x} className="flex gap-2 items-center text-[#115e59]">
                <span className="font-bold">✓</span>
                <i className="not-italic text-[#64748b]">{x}</i>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Value props */}
      <section className="bg-white">
        <div className="v2-container v2-section">
          <div className="v2-eyebrow">De ce NITIDO</div>
          <h2 className="v2-h2 mt-3">Mai multe lucrări, reguli clare, zero surprize.</h2>
          <div className="grid grid-cols-3 gap-4 mt-9 max-md:grid-cols-1">
            {VALUE_PROPS.map((v) => (
              <article key={v.title} className="bg-[#f7f9fc] rounded-2xl p-[26px]">
                <h3 className="font-bold text-lg">{v.title}</h3>
                <p className="text-sm text-[#64748b] leading-6 mt-2">{v.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="v2-container v2-section">
        <div className="v2-eyebrow">Cum intri</div>
        <h2 className="v2-h2 mt-3">Trei pași până la prima lucrare.</h2>
        <div className="grid grid-cols-3 gap-4 mt-9 max-md:grid-cols-1">
          {STEPS.map((s) => (
            <article key={s.n} className="v2-card p-[26px]">
              <div className="text-sm font-bold text-[#0f766e]">{s.n}</div>
              <h3 className="font-bold text-lg mt-8">{s.title}</h3>
              <p className="text-sm text-[#64748b] leading-6 mt-2">{s.text}</p>
            </article>
          ))}
        </div>
      </section>

      {/* City focus */}
      <section className="bg-white">
        <div className="v2-container v2-section">
          <div className="rounded-[20px] bg-[#111827] p-8 text-white md:p-12">
            <div className="text-xs font-bold text-[#8fd8ae]">LANSARE PILOT</div>
            <h2 className="mt-4 max-w-3xl text-4xl font-bold max-md:text-3xl">
              Căutăm firme în București și Constanța.
            </h2>
            <p className="mt-5 max-w-3xl leading-7 text-[#b8c1bb]">
              Pornim concentrat, ca fiecare firmă înscrisă la început să prindă cerere reală în zona ei. Dacă activezi în
              aceste orașe și vrei lucrări constante, cu plată securizată și clienți serioși, e momentul să te înscrii.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {["București", "Constanța"].map((c) => (
                <span key={c} className="rounded-full bg-[#0f766e]/20 text-[#8fd8ae] px-4 py-2 text-sm font-bold">
                  📍 {c}
                </span>
              ))}
            </div>
            <Link href="/signup?role=firma" className="v2-btn v2-btn-primary mt-8">Înregistrează firma</Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="v2-container v2-section">
        <div className="v2-eyebrow">Întrebări frecvente</div>
        <h2 className="v2-h2 mt-3">Ce vor firmele să știe.</h2>
        <div className="grid grid-cols-2 gap-4 mt-9 v2-mobile-stack">
          {FAQ.map((f) => (
            <article className="v2-card p-6" key={f.q}>
              <h3 className="font-bold">{f.q}</h3>
              <p className="text-sm text-[#64748b] mt-2 leading-6">{f.a}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-white">
        <div className="v2-container v2-section text-center">
          <h2 className="v2-h2">Gata să primești prima lucrare?</h2>
          <p className="mx-auto mt-5 max-w-2xl leading-7 text-[#64748b]">
            Înregistrarea durează câteva minute. Fără abonament, fără costuri ascunse — plătești doar când muncești.
          </p>
          <Link href="/signup?role=firma" className="v2-btn v2-btn-primary mt-8">Înregistrează firma gratuit</Link>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
