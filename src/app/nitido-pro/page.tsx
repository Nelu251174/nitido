import Link from "next/link";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "NITIDO Pro — Operațiuni pentru portofolii",
  alternates: { canonical: "/nitido-pro" },
};
const features = [
  [
    "Lucrări recurente",
    "Programezi și urmărești curățenia, verificările și activitățile periodice pe fiecare proprietate.",
  ],
  [
    "Mentenanță controlată",
    "Problemele sunt înregistrate, triate, estimate și urmărite până la rezolvare.",
  ],
  [
    "Verificări",
    "Confirmi calitatea lucrării și starea proprietății prin checklist și observații.",
  ],
  [
    "Aprobări de cost",
    "Costurile peste pragul stabilit nu se execută fără decizia persoanei autorizate.",
  ],
  [
    "Dovezi foto",
    "Fotografii înainte, după și la remediere, asociate clar cu lucrarea.",
  ],
  [
    "Costuri centralizate",
    "Vezi cheltuieli pe proprietate, serviciu și perioadă.",
  ],
  [
    "Parteneri verificați",
    "Lucrările sunt coordonate prin parteneri eligibili și evaluați operațional.",
  ],
];
export default function Page() {
  return (
    <div className="pro-wrap">
      <section className="pro-hero">
        <div>
          <p className="pro-eyebrow">Pentru portofolii de proprietăți</p>
          <h1>NITIDO Pro</h1>
          <h2>Operațiuni controlate pentru proprietățile tale.</h2>
          <p className="pro-muted">
            Sistemul de operare pentru proprietăți care centralizează lucrările
            recurente, mentenanța, verificările, aprobările, dovezile foto,
            costurile și furnizorii într-un singur flux controlat.
          </p>
          <div className="pro-actions">
            <Link href="/nitido-pro/aplica" className="v2-btn v2-btn-primary">
              Solicită evaluarea portofoliului
            </Link>
            <a href="#cum-functioneaza" className="v2-btn v2-btn-secondary">
              Vezi cum funcționează
            </a>
          </div>
          <p className="text-xs pro-muted">
            Disponibil inițial pentru portofolii eligibile din zonele acoperite
            de NITIDO Pro.
          </p>
        </div>
        <div
          className="pro-preview"
          aria-label="Previzualizare cu date demonstrative"
        >
          <div className="pro-preview-head">
            <strong>Portofoliul tău, la vedere.</strong>
            <span className="pro-demo">DEMO</span>
          </div>
          <div className="pro-stats">
            {[
              ["18", "Proprietăți active"],
              ["7", "Lucrări astăzi"],
              ["2", "Necesită aprobare"],
              ["5", "Verificări finalizate"],
            ].map(([n, l]) => (
              <div className="pro-stat" key={l}>
                <strong>{n}</strong>
                <span>{l}</span>
              </div>
            ))}
          </div>
          <div className="pro-preview-row">
            <span>Tichete urgente</span>
            <strong>1</strong>
          </div>
          <div className="pro-preview-row">
            <span>Costuri perioadă</span>
            <strong>8.420 lei</strong>
          </div>
          <p className="text-xs mt-4 text-slate-300">
            Exemplu demonstrativ. Datele reale apar după activarea
            portofoliului.
          </p>
        </div>
      </section>
      <section className="pro-section">
        <p className="pro-eyebrow">Mai multă ordine. Mai puține întrebări.</p>
        <h2>
          Când portofoliul crește, WhatsApp-ul nu mai este sistem de operare.
        </h2>
        <div className="pro-two">
          <div className="pro-card">
            <h3>Fără NITIDO Pro</h3>
            <ul>
              <li>Apeluri, mesaje și confirmări verbale</li>
              <li>Poze pierdute între conversații</li>
              <li>Costuri aprobate informal</li>
              <li>Furnizori fără istoric</li>
              <li>Probleme tratate reactiv</li>
            </ul>
          </div>
          <div className="pro-card">
            <h3>Cu NITIDO Pro</h3>
            <ul>
              <li>Lucrări cu status și responsabil</li>
              <li>Dovezi asociate fiecărei lucrări</li>
              <li>Praguri și aprobări documentate</li>
              <li>Parteneri verificați și evaluați</li>
              <li>Tichete, priorități și urmărire</li>
            </ul>
          </div>
        </div>
        <p className="mt-6">
          Fiecare lucrare are un responsabil, un status, o dovadă, un cost și un
          istoric.
        </p>
      </section>
      <section className="pro-section">
        <h2>Un singur flux pentru operațiunile care se repetă.</h2>
        <div className="pro-grid">
          {features.map(([title, desc], i) => (
            <article className="pro-card" key={title}>
              <div className="pro-step">0{i + 1}</div>
              <h3>{title}</h3>
              <p>{desc}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="pro-section" id="cum-functioneaza">
        <h2>De la portofoliu la raportare, în cinci pași clari.</h2>
        <div className="pro-grid">
          {[
            [
              "Evaluăm portofoliul",
              "Confirmăm zona, proprietățile și volumul de lucru.",
            ],
            [
              "Configurăm proprietățile și regulile",
              "Stabilim serviciile, responsabilii și pragurile de aprobare.",
            ],
            [
              "Confirmăm bugetul și alocăm lucrările",
              "Partenerul primește informațiile necesare după acceptare.",
            ],
            [
              "Verificăm și documentăm execuția",
              "Checklist, fotografii și verificare documentară.",
            ],
            [
              "Verifici costurile finale și primești raportul",
              "Cheltuielile și istoricul rămân asociate proprietății.",
            ],
          ].map(([t, d], i) => (
            <article className="pro-card" key={t}>
              <div className="pro-step">PASUL {i + 1}</div>
              <h3>{t}</h3>
              <p>{d}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="pro-section">
        <h2>Creat pentru portofolii care au nevoie de control operațional.</h2>
        <p className="pro-muted">
          Creat pentru proprietari, administratori și operatori care gestionează
          mai multe proprietăți și au nevoie de control, nu doar de o firmă
          disponibilă.
        </p>
        <div className="pro-grid">
          {[
            "Administratori de apartamente în regim hotelier",
            "Operatori de short-term rental",
            "Agenții de administrare proprietăți",
            "Investitori cu minimum 5 proprietăți",
            "Aparthoteluri și unități de cazare",
            "Proprietari care gestionează de la distanță",
          ].map((t) => (
            <div className="pro-card" key={t}>
              <h3>{t}</h3>
            </div>
          ))}
        </div>
        <p className="mt-6">
          <strong>Nu este pentru orice situație.</strong> Pentru o singură
          proprietate sau curățenie ocazională,{" "}
          <Link className="underline" href="/rezervare">
            folosește marketplace-ul NITIDO
          </Link>
          . Pro nu este un serviciu pentru toate reparațiile sau o promisiune de
          cel mai mic preț.
        </p>
      </section>
      <section className="pro-section" id="servicii">
        <h2>Un catalog controlat de servicii, nu promisiuni fără limită.</h2>
        <div className="pro-two">
          <div className="pro-card">
            <h3>Disponibil în pilot</h3>
            <ul>
              {[
                "Curățenie recurentă și turnover programat manual",
                "Verificări proprietate",
                "Control de calitate documentar",
                "Refill consumabile",
                "Mentenanță ușoară din catalogul aprobat",
                "Ticketing incidente",
                "Raportare operațională",
              ].map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
          <div className="pro-card">
            <h3>Nu este inclus inițial</h3>
            <ul>
              {[
                "Renovări și lucrări majore",
                "Gaze și intervenții tehnice reglementate",
                "Intervenții 24/7 garantate",
                "Administrare fiscală sau juridică",
                "Integrare Airbnb / Booking",
                "Marketplace general de meseriași",
              ].map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>
      <section className="pro-section">
        <h2>Datele proprietății sunt vizibile numai când sunt necesare.</h2>
        <div className="pro-grid">
          {[
            [
              "Înainte de acceptare",
              "Partenerul vede zona, serviciul și intervalul.",
            ],
            [
              "După acceptare",
              "Primește adresa și instrucțiunile necesare lucrării.",
            ],
            [
              "La finalizare",
              "Accesul operațional în platformă expiră. Codurile sunt limitate la fereastra autorizată.",
            ],
          ].map(([t, d]) => (
            <div className="pro-card" key={t}>
              <h3>{t}</h3>
              <p>{d}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="pro-section" id="intrebari">
        <h2>Bine de știut.</h2>
        {[
          [
            "Câte proprietăți sunt necesare?",
            "Pilotul este destinat portofoliilor de minimum 5 proprietăți din zone eligibile.",
          ],
          [
            "Cum se plătesc serviciile?",
            "Condițiile și circuitul de facturare se stabilesc contractual înainte de activare. Nu sunt disponibile plăți automate Pro în pilot.",
          ],
          [
            "Pot folosi platforma de pe telefon?",
            "Da, interfața web este adaptată telefonului.",
          ],
          [
            "Ce înseamnă verificare?",
            "Checklistul și fotografiile sunt revizuite documentar. Verificarea la proprietate este un serviciu stabilit separat.",
          ],
        ].map(([t, d]) => (
          <details className="pro-card mb-3" key={t}>
            <summary className="font-bold cursor-pointer">{t}</summary>
            <p className="mt-3">{d}</p>
          </details>
        ))}
      </section>
      <section className="pro-section">
        <h2>Verifică dacă portofoliul tău este eligibil pentru NITIDO Pro.</h2>
        <p>
          Analizăm zona, numărul de proprietăți, volumul operațional și
          serviciile necesare înainte de activare.
        </p>
        <div className="pro-actions">
          <Link href="/nitido-pro/aplica" className="v2-btn v2-btn-primary">
            Solicită evaluarea portofoliului
          </Link>
          <Link
            href="/nitido-pro/parteneri"
            className="v2-btn v2-btn-secondary"
          >
            Devino partener NITIDO Pro
          </Link>
          <Link href="/pro/dashboard" className="underline text-sm">
            Acces portofoliu activ
          </Link>
        </div>
      </section>
    </div>
  );
}
