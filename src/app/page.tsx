import Link from "next/link";
import { Logo } from "@/components/ui";
import { PriceCalculator } from "@/components/PriceCalculator";
import { Faq } from "@/components/Faq";
import { db } from "@/lib/db";

// Fără asta, Next.js ar preda-randa homepage-ul static la build — statisticile
// de mai jos ar rămâne înghețate la valorile din momentul build-ului, nu ar
// mai reflecta niciodată date reale, actualizate.
export const dynamic = "force-dynamic";

function getPublicTrustStats() {
  const completedJobs = db
    .prepare("SELECT COUNT(*) as n FROM jobs WHERE status = 'completed'")
    .get() as { n: number };
  const firmStats = db
    .prepare(
      `SELECT COUNT(*) as verifiedFirms,
              COALESCE(SUM(rating_sum), 0) as ratingSum,
              COALESCE(SUM(rating_count), 0) as ratingCount
       FROM firms WHERE verified = 1`
    )
    .get() as { verifiedFirms: number; ratingSum: number; ratingCount: number };
  return {
    completedJobs: completedJobs.n,
    verifiedFirms: firmStats.verifiedFirms,
    avgRating: firmStats.ratingCount > 0 ? Math.round((firmStats.ratingSum / firmStats.ratingCount) * 10) / 10 : null,
    ratingCount: firmStats.ratingCount,
  };
}

export default function Home() {
  // Dovadă socială reală — nu afișăm secțiunea deloc dacă platforma e prea la
  // început ca cifrele să însemne ceva (fără numere false/estimate, niciodată).
  const trust = getPublicTrustStats();
  const showTrustSection = trust.completedJobs >= 5 || trust.verifiedFirms >= 3;

  return (
    <div className="min-h-screen bg-white">
      <header className="glass sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Logo />
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted">
            <a href="#cum-functioneaza" className="hover:text-ink transition">
              Cum funcționează
            </a>
            <a href="#calculator" className="hover:text-ink transition">
              Preț
            </a>
            <a href="#pentru-firme" className="hover:text-ink transition">
              Pentru firme
            </a>
            <a href="#incredere" className="hover:text-ink transition">
              Siguranță &amp; plată
            </a>
            <a href="#intrebari" className="hover:text-ink transition">
              Întrebări
            </a>
          </nav>
          <div className="flex gap-3 text-sm font-display font-bold items-center">
            <Link href="/login" className="px-4 py-2 rounded-full hover:bg-ink/5 transition">
              Autentificare
            </Link>
            <Link
              href="/signup"
              className="px-4 py-2 rounded-full btn-aurora text-white transition hover:-translate-y-0.5"
            >
              Creează cont
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="mesh-dark relative overflow-hidden">
        <div className="pointer-events-none absolute -top-32 -right-16 w-[28rem] h-[28rem] rounded-full bg-aqua/25 blur-3xl animate-blob" />
        <div className="pointer-events-none absolute top-1/2 -left-24 w-80 h-80 rounded-full bg-indigo/25 blur-3xl animate-blob-slow animate-blob-delay" />
        <div className="pointer-events-none absolute bottom-0 right-1/4 w-72 h-72 rounded-full bg-coral/15 blur-3xl animate-blob-slow" />

        <div className="relative max-w-6xl mx-auto px-6 py-20 md:py-28 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <span className="inline-block glass-dark rounded-full px-3 py-1 text-[12px] font-display font-bold text-aqua mb-6">
              Marketplace de curățenie · România
            </span>
            <h1 className="font-display font-extrabold text-4xl md:text-5xl text-white leading-tight">
              Postezi lucrarea. <span className="text-gradient text-gradient-animated">Prima firmă</span> care apasă „Accept&quot; o ia.
            </h1>
            <p className="text-white/60 text-lg mt-6 max-w-xl leading-relaxed">
              Nitido conectează instant proprietari de apartamente, case și birouri cu firme de
              curățenie verificate. Fără programare clasică, fără așteptare — alertă instant către
              firmele din zonă, preț afișat de la început.
            </p>
            <div className="flex flex-wrap gap-4 mt-10">
              <Link
                href="/signup?role=client"
                className="px-6 py-3.5 rounded-full btn-aurora text-white font-display font-bold transition hover:-translate-y-0.5"
              >
                Postează o lucrare
              </Link>
              <Link
                href="/signup?role=firma"
                className="px-6 py-3.5 rounded-full glass-dark text-white font-display font-bold hover:bg-white/10 transition"
              >
                Înregistrează-ți firma
              </Link>
            </div>
            <div className="flex items-center gap-6 mt-10 text-sm text-white/60">
              <span className="flex items-center gap-1.5">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="8" fill="#17B8A6" />
                  <path d="M4.5 8.2l2.2 2.2L11.5 5.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Firme verificate
              </span>
              <span className="flex items-center gap-1.5">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="8" fill="#17B8A6" />
                  <path d="M4.5 8.2l2.2 2.2L11.5 5.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Preț fix, fără surprize
              </span>
            </div>
          </div>

          <HeroIllustration />
        </div>
      </section>

      {/* STATS */}
      <section className="border-b border-line bg-white">
        <div className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <StatCard value="Gratuit" label="înscriere pentru firme" />
          <StatCard value="1h" label="anunț minim pentru programare" />
          <StatCard value="1-click" label="acceptare pentru firme" />
          <StatCard value="100%" label="plată securizată prin Stripe" />
        </div>
      </section>

      {/* DOVADĂ SOCIALĂ — cifre reale, ascunsă dacă platforma e prea la început */}
      {showTrustSection && (
        <section className="mesh-light border-b border-line">
          <div className="max-w-6xl mx-auto px-6 py-10 flex flex-wrap justify-center gap-x-16 gap-y-8 text-center">
            <Stat value={String(trust.completedJobs)} label="lucrări finalizate pe platformă" />
            <Stat value={String(trust.verifiedFirms)} label="firme verificate la ANAF" />
            {trust.avgRating !== null && (
              <Stat value={`${trust.avgRating} ★`} label={`din ${trust.ratingCount} evaluări`} />
            )}
          </div>
        </section>
      )}

      {/* CUM FUNCTIONEAZA */}
      <section id="cum-functioneaza" className="max-w-6xl mx-auto px-6 py-24">
        <div className="max-w-2xl mb-14">
          <span className="text-xs font-display font-bold text-aqua-deep uppercase tracking-wide">
            Cum funcționează
          </span>
          <h2 className="font-display font-extrabold text-3xl text-ink mt-2">
            De la postare la curățenie, în trei pași
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-10">
          <Step
            number="1"
            title="Postezi lucrarea"
            description="Adresă, tip spațiu, suprafață — prețul apare instant, înainte să confirmi."
          />
          <Step
            number="2"
            title="O firmă acceptă"
            description="Toate firmele din zonă primesc alerta simultan. Prima care apasă „Accept” o preia."
          />
          <Step
            number="3"
            title="Plata se decontează"
            description="Banii se rezervă la acceptare și ajung la firmă abia după finalizarea confirmată."
          />
        </div>
      </section>

      {/* CALCULATOR */}
      <section id="calculator" className="mesh-light border-y border-line">
        <div className="max-w-6xl mx-auto px-6 py-24 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <span className="text-xs font-display font-bold text-aqua-deep uppercase tracking-wide">
              Preț transparent
            </span>
            <h2 className="font-display font-extrabold text-3xl text-ink mt-2 leading-tight">
              Vezi prețul înainte să postezi, nu după.
            </h2>
            <p className="text-muted mt-5 leading-relaxed max-w-md">
              Prețul se calculează automat, pe o grilă fixă, în funcție de tipul de spațiu și
              suprafață — același preț pe care-l vede și firma care acceptă. Fără licitație, fără
              negociere ulterioară.
            </p>
          </div>
          <PriceCalculator />
        </div>
      </section>

      {/* PENTRU FIRME */}
      <section id="pentru-firme" className="mesh-dark relative overflow-hidden text-white">
        <div className="pointer-events-none absolute top-0 left-1/3 w-96 h-96 rounded-full bg-indigo/20 blur-3xl animate-blob-slow" />
        <div className="pointer-events-none absolute bottom-0 -right-10 w-80 h-80 rounded-full bg-aqua/20 blur-3xl animate-blob animate-blob-delay" />
        <div className="relative max-w-6xl mx-auto px-6 py-24 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <span className="text-xs font-display font-bold text-aqua uppercase tracking-wide">
              Pentru firme de curățenie
            </span>
            <h2 className="font-display font-extrabold text-3xl mt-2 leading-tight">
              Lucrări noi, direct în zona ta — fără telefoane, fără negociere.
            </h2>
            <p className="text-white/70 mt-5 leading-relaxed">
              Te înregistrezi o dată, setezi zona de acoperire, și primești alerte instant pentru
              lucrări noi. Accepți cu un click. Nu vezi niciodată comisionul afișat — doar suma
              exactă pe care o încasezi.
            </p>
            <Link
              href="/signup?role=firma"
              className="inline-block mt-8 px-6 py-3.5 rounded-full btn-aurora text-white font-display font-bold transition hover:-translate-y-0.5"
            >
              Înregistrează-ți firma
            </Link>
          </div>
          <div className="space-y-4">
            <FirmBenefit
              title="Alertă instant"
              description="Notificare imediat ce un client postează o lucrare eligibilă în zona ta."
            />
            <FirmBenefit
              title="Fără dispută pe preț"
              description="Suma pe care o vezi e exact ce încasezi — comisionul e deja scăzut."
            />
            <FirmBenefit
              title="Reputație construită corect"
              description="Rating vizibil public, plus protecție împotriva clienților problematici."
            />
          </div>
        </div>
      </section>

      {/* INCREDERE / PLATA */}
      <section id="incredere" className="max-w-6xl mx-auto px-6 py-24">
        <div className="grid md:grid-cols-2 gap-12 items-start">
          <div>
            <span className="text-xs font-display font-bold text-aqua-deep uppercase tracking-wide">
              Siguranță &amp; plată
            </span>
            <h2 className="font-display font-extrabold text-3xl text-ink mt-2 leading-tight">
              Banii se mișcă doar când lucrarea chiar se întâmplă.
            </h2>
            <p className="text-muted mt-5 leading-relaxed">
              La acceptare, suma e doar rezervată pe cardul tău — nu se retrage nimic. Se
              decontează efectiv abia după ce lucrarea e confirmată ca finalizată. Dacă firma nu
              se prezintă, rezervarea se anulează automat, fără nicio interacțiune din partea ta.
            </p>
          </div>
          <div className="border-gradient bg-mist rounded-3xl p-8">
            <TrustRow title="Rezervare la acceptare" description="Cardul e doar autorizat, nu debitat." />
            <TrustRow title="Decontare la finalizare" description="Firma încasează abia după confirmare." />
            <TrustRow title="Anulare automată la no-show" description="Fără nicio sumă reținută dacă firma nu apare." last />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="intrebari" className="max-w-6xl mx-auto px-6 py-24">
        <div className="max-w-2xl mx-auto text-center mb-14">
          <span className="text-xs font-display font-bold text-aqua-deep uppercase tracking-wide">
            Întrebări frecvente
          </span>
          <h2 className="font-display font-extrabold text-3xl text-ink mt-2">
            Ce mai vrei să știi
          </h2>
        </div>
        <Faq />
      </section>

      <footer className="border-t border-line bg-mist">
        <div className="max-w-6xl mx-auto px-6 py-16 grid md:grid-cols-4 gap-10">
          <div>
            <Logo />
            <p className="text-sm text-muted mt-4 leading-relaxed max-w-xs">
              Marketplace de curățenie — conectăm clienți cu firme verificate, instant.
            </p>
          </div>

          <div>
            <h4 className="font-display font-bold text-xs uppercase tracking-wide text-muted mb-4">
              Produs
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li><a href="#cum-functioneaza" className="text-muted hover:text-ink transition">Cum funcționează</a></li>
              <li><a href="#calculator" className="text-muted hover:text-ink transition">Calculează prețul</a></li>
              <li><Link href="/signup?role=firma" className="text-muted hover:text-ink transition">Pentru firme</Link></li>
              <li><a href="#intrebari" className="text-muted hover:text-ink transition">Întrebări frecvente</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-display font-bold text-xs uppercase tracking-wide text-muted mb-4">
              Legal
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/termeni" className="text-muted hover:text-ink transition">Termeni și condiții</Link></li>
              <li><Link href="/confidentialitate" className="text-muted hover:text-ink transition">Confidențialitate</Link></li>
              <li><Link href="/cookie-uri" className="text-muted hover:text-ink transition">Cookie-uri</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-display font-bold text-xs uppercase tracking-wide text-muted mb-4">
              Contact
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <a href="mailto:contact@nitido.ro" className="text-muted hover:text-ink transition">
                  contact@nitido.ro
                </a>
              </li>
              <li className="text-muted">România</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-line">
          <div className="max-w-6xl mx-auto px-6 py-6 text-sm text-muted">
            © {new Date().getFullYear()} Nitido. Marketplace de curățenie, România.
          </div>
        </div>
      </footer>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="font-display font-extrabold text-2xl md:text-3xl text-gradient">{value}</div>
      <div className="text-xs md:text-sm text-muted mt-1">{label}</div>
    </div>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5 shadow-[0_1px_2px_rgba(20,37,48,0.04),0_8px_24px_-12px_rgba(20,37,48,0.1)] transition-transform duration-200 hover:-translate-y-1">
      <div className="font-display font-extrabold text-2xl md:text-3xl text-ink">{value}</div>
      <div className="text-xs md:text-sm text-muted mt-1">{label}</div>
    </div>
  );
}

function Step({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div>
      <div className="w-10 h-10 rounded-full btn-aurora text-white font-display font-bold flex items-center justify-center mb-4">
        {number}
      </div>
      <h3 className="font-display font-bold text-lg text-ink mb-2">{title}</h3>
      <p className="text-sm text-muted leading-relaxed">{description}</p>
    </div>
  );
}

function FirmBenefit({ title, description }: { title: string; description: string }) {
  return (
    <div className="glass-dark rounded-2xl p-5 transition-transform duration-200 hover:-translate-y-0.5">
      <h4 className="font-display font-bold text-sm mb-1">{title}</h4>
      <p className="text-sm text-white/60 leading-relaxed">{description}</p>
    </div>
  );
}

function TrustRow({ title, description, last }: { title: string; description: string; last?: boolean }) {
  return (
    <div className={`flex items-start gap-3 py-4 ${last ? "" : "border-b border-line"}`}>
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="flex-shrink-0 mt-0.5">
        <circle cx="10" cy="10" r="10" fill="#17B8A6" />
        <path d="M5.5 10.2l2.7 2.7L14.5 6.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div>
        <div className="font-display font-bold text-sm text-ink">{title}</div>
        <div className="text-sm text-muted mt-0.5">{description}</div>
      </div>
    </div>
  );
}

function HeroIllustration() {
  return (
    <svg viewBox="0 0 480 420" className="w-full h-auto" xmlns="http://www.w3.org/2000/svg">
      <rect x="40" y="30" width="400" height="360" rx="24" fill="#FFFFFF" stroke="#E1E8E6" strokeWidth="2" />
      <rect x="40" y="30" width="400" height="56" rx="24" fill="#142530" />
      <rect x="40" y="62" width="400" height="24" fill="#142530" />
      <text x="66" y="64" fontFamily="Arial, sans-serif" fontSize="15" fontWeight="800" fill="#FFFFFF">
        Nit<tspan fill="#17B8A6">ido</tspan>
      </text>

      {/* alert card */}
      <rect x="66" y="112" width="348" height="150" rx="16" fill="#F1F5F4" stroke="#17B8A6" strokeWidth="2" />
      <rect x="90" y="134" width="120" height="22" rx="11" fill="#FF6B5B" />
      <text x="100" y="149" fontFamily="Arial, sans-serif" fontSize="11" fontWeight="700" fill="white">
        LUCRARE NOUĂ
      </text>
      <rect x="90" y="168" width="220" height="14" rx="4" fill="#142530" opacity="0.85" />
      <rect x="90" y="188" width="160" height="10" rx="4" fill="#63767A" opacity="0.6" />
      <rect x="90" y="212" width="80" height="26" rx="8" fill="white" stroke="#E1E8E6" strokeWidth="1.5" />
      <rect x="180" y="212" width="80" height="26" rx="8" fill="white" stroke="#E1E8E6" strokeWidth="1.5" />
      <rect x="300" y="205" width="90" height="40" rx="10" fill="#17B8A6" />
      <text x="320" y="230" fontFamily="Arial, sans-serif" fontSize="12" fontWeight="700" fill="white">
        Accept
      </text>

      {/* status track */}
      <g transform="translate(66, 286)">
        <circle cx="8" cy="8" r="8" fill="#17B8A6" />
        <rect x="26" y="3" width="180" height="10" rx="5" fill="#142530" opacity="0.75" />
        <circle cx="8" cy="46" r="8" fill="#17B8A6" />
        <rect x="26" y="41" width="220" height="10" rx="5" fill="#142530" opacity="0.75" />
        <circle cx="8" cy="84" r="8" fill="#E1E8E6" />
        <rect x="26" y="79" width="140" height="10" rx="5" fill="#63767A" opacity="0.4" />
      </g>

      {/* pin accent */}
      <g transform="translate(372, 300)">
        <circle cx="24" cy="24" r="24" fill="#FF6B5B" opacity="0.12" />
        <path
          d="M24 8c-8 0-14 6-14 14 0 10 14 26 14 26s14-16 14-26c0-8-6-14-14-14z"
          fill="#FF6B5B"
        />
        <circle cx="24" cy="22" r="6" fill="white" />
      </g>
    </svg>
  );
}
