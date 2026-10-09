import { publicPageMetadata } from "@/lib/publicSeo";
export const metadata = publicPageMetadata("/inscrie-firma");
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";



const VALUE_PROPS: { title: string; text: string }[] = [
  { title: "0 lei la start", text: "Înregistrarea și crearea profilului nu presupun taxă de înscriere sau abonament în oferta afișată. Comisionul se aplică lucrărilor executate conform fluxului platformei. Înscrierea nu garantează un volum de comenzi: disponibilitatea depinde de solicitările clienților, aria acoperită și eligibilitatea firmei." },
  { title: "Păstrezi 82% din preț", text: "Comisionul platformei este de 18%, iar partea firmei este de 82% din prețul aferent lucrării, conform detaliilor afișate. Această sumă nu este profitul firmei: cheltuielile cu personalul, transportul, materialele și obligațiile fiscale rămân în responsabilitatea ta. Verifică suma înainte să confirmi disponibilitatea." },
  { title: "Plată asociată rezervării", text: "Clientul folosește metoda de plată cerută de rezervare, iar autorizarea și încasarea sunt urmărite în platformă. Un card salvat nu reprezintă verificarea identității clientului și nu elimină orice risc de plată. Consultă starea confirmată a lucrării înainte de deplasare și semnalează eventualele erori." },
  { title: "Fără licitație de preț", text: "Prețul este calculat pe baza configurației lucrării. La Standard, clientul compară firmele candidate și alege pe baza informațiilor disponibile, inclusiv reputație și experiență. Înainte să candidezi, verifică serviciul, suprafața și programarea. Dacă cerința depășește serviciul descris, solicită clarificări." },
  { title: "Nitido Quality Index", text: "Profilul și istoricul lucrărilor îi ajută pe clienți să compare firmele. Evaluările și respectarea programărilor oferă context despre activitatea ta. Prezintă experiența reală și documentează corect intervențiile. O reputație bună poate conta în selecție, dar nu reprezintă o promisiune de comenzi sau venituri." },
  { title: "Plată securizată Stripe", text: "Procesarea plății folosește Stripe, iar capturarea urmează finalizarea validă a lucrării. Verifică starea contului conectat și cerințele afișate pentru încasări. Momentul în care transferul ajunge în contul bancar depinde și de procesator și de bancă; finalizarea lucrării nu înseamnă transfer bancar instant." },
];

const STEPS: { n: string; title: string; text: string }[] = [
  { n: "01", title: "Înregistrează firma", text: "Completează datele reprezentantului, CUI-ul și localitățile acoperite. Validarea firmei active se face prin sursa ANAF atunci când este disponibilă. Verifică mesajele din cont și corectează eventualele informații neconforme. Declară numai zonele în care poți onora efectiv programările." },
  { n: "02", title: "Primești lucrări în zona ta", text: "Consultă lucrările eligibile din aria declarată și verifică resursele necesare înainte de acțiune. La Standard, trimiți candidatura și aștepți selecția clientului. La Express, poți prelua prin prima acceptare eligibilă confirmată. Alertele depind de canalele active; verifică și panoul firmei." },
  { n: "03", title: "Execuți și încasezi", text: "Respectă programarea, actualizează etapele reale și încarcă dovezile foto solicitate la sosire și la finalizare. După încheierea validă, urmărește separat starea plății și a transferului. Pentru probleme de acces, execuție sau încasare, cere suport cu identificatorul lucrării." },
];

const FAQ: { q: string; a: string }[] = [
  { q: "Cât costă înscrierea?", a: "Nimic. Înregistrarea și profilul sunt gratuite. Comisionul de 18% se aplică doar pe lucrările executate." },
  { q: "Cum îmi verificați firma?", a: "Introduci CUI-ul, iar NITIDO încearcă validarea firmei active prin ANAF. Profilul devine „verificat” când sursa confirmă o entitate activă." },
  { q: "Când primesc adresa exactă a clientului?", a: "Adresa exactă și fotografiile autorizate se dezvăluie doar firmei căreia i s-a alocat lucrarea — după acceptare." },
  { q: "Când primesc banii?", a: "Suma e rezervată la acceptare și capturată după finalizarea confirmată. Încasările trec prin contul tău Stripe conectat." },
];

export default function InscrieFirmaPage() {
  return (
    <main className="bg-[#f7f9fc] text-[#111827]">
      <SiteHeader />

      {/* Hero */}
      <section className="v2-container py-16 pb-14 max-md:py-12">
        <div className="max-w-3xl">
          <div className="inline-flex rounded-full bg-[var(--nitido-brand-soft)] text-[var(--nitido-brand-dark)] px-4 py-2 text-xs font-bold mb-6">
            Parteneri NITIDO · București &amp; Constanța
          </div>
          <h1 className="text-[56px] max-md:text-[38px] leading-[1.05] tracking-[-.035em] font-bold">
            Firma ta de curățenie primește lucrări plătite. <span className="text-[var(--nitido-brand)]">Fără abonament.</span>
          </h1>
          <p className="mt-6 text-[17px] leading-7 text-[#3e4842] max-w-2xl">
            NITIDO.RO conectează firma ta cu solicitări de curățenie din zonele acoperite. Trimiți ofertă sau preiei urgențele
            când ești eligibil și disponibil — prețul e calculat în platformă, tu te concentrezi pe calitate. Lansăm întâi în <b>București</b> și <b>Constanța</b>.
          </p>
          <div className="flex flex-wrap gap-3 mt-8">
            <Link href="/signup?role=firma" className="v2-btn v2-btn-primary">Înregistrează firma gratuit</Link>
            <Link href="/pentru-firme" className="v2-btn v2-btn-secondary">Citește ghidul pentru firme</Link>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 mt-8 text-sm text-[#64748b]">
            {["Fără taxă de înscriere", "Comision fix 18%", "Verificare ANAF"].map((x) => (
              <span key={x} className="flex gap-2 items-center text-[var(--nitido-brand-dark)]">
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
          <h2 className="v2-h2 mt-3">Înțelege condițiile înainte să înscrii firma.</h2>
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
              <div className="text-sm font-bold text-[var(--nitido-brand)]">{s.n}</div>
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
            <div className="text-xs font-bold text-[var(--nitido-brand-on-dark)]">LANSARE PILOT</div>
            <h2 className="mt-4 max-w-3xl text-4xl font-bold max-md:text-3xl">
              Căutăm firme în București și Constanța.
            </h2>
            <p className="mt-5 max-w-3xl leading-7 text-[#b8c1bb]">
              Pornim concentrat, ca fiecare firmă înscrisă la început să prindă cerere reală în zona ei. Dacă activezi în
              aceste orașe și vrei lucrări constante, cu plată securizată și clienți serioși, e momentul să te înscrii.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {["București", "Constanța"].map((c) => (
                <span key={c} className="rounded-full bg-[var(--nitido-brand)]/20 text-[var(--nitido-brand-on-dark)] px-4 py-2 text-sm font-bold">
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
