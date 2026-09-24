import Link from "next/link";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "NITIDO Pro — Operațiuni pentru portofolii",
  alternates: { canonical: "/nitido-pro" },
};
const features = [
  [
    "Lucrări recurente",
    "Pentru fiecare proprietate stabilești activitățile recurente și intervalele de lucru, apoi urmărești lucrările create și persoanele responsabile. Istoricul îți permite să vezi ce a fost planificat, ce s-a executat și unde sunt necesare clarificări. În pilot, turnover-ul este programat manual; nu presupune o sincronizare automată cu platformele de rezervări.",
  ],
  [
    "Mentenanță controlată",
    "O problemă este înregistrată cu proprietatea, descrierea și prioritatea ei, pentru a putea fi analizată înainte de alocare. Serviciul, costul și responsabilul trebuie clarificate. Catalogul pilot include mentenanță ușoară aprobată, nu orice reparație. Intervențiile majore sau reglementate necesită un parcurs separat și nu sunt promise prin simpla creare a unui tichet.",
  ],
  [
    "Verificări",
    "Checklistul, observațiile și fotografiile documentează activitatea efectuată. Revizuirea documentară ajută la identificarea lipsurilor și la solicitarea clarificărilor. Ea nu înseamnă că un inspector a vizitat fizic proprietatea. O verificare la locație trebuie stabilită ca serviciu distinct, cu scop, programare și responsabil.",
  ],
  [
    "Aprobări de cost",
    "Regulile portofoliului stabilesc cine poate decide asupra costurilor și ce solicitări necesită aprobare. Persoana autorizată verifică motivul, suma și lucrarea asociată înainte de a decide. Istoricul păstrează contextul aprobării. O propunere de cost nu este același lucru cu o plată efectuată sau cu o factură emisă.",
  ],
  [
    "Dovezi foto",
    "Imaginile sunt asociate lucrării pentru a putea compara situația inițială, rezultatul și eventualele remedieri. Partenerul trebuie să încarce dovezi relevante, fără persoane, documente sau coduri de acces inutile în cadru. Dacă imaginile nu explică suficient rezultatul, se pot solicita clarificări în parcursul de verificare.",
  ],
  [
    "Costuri centralizate",
    "Înregistrările de cost sunt legate de proprietăți și lucrări, astfel încât să urmărești ce serviciu a generat o sumă și în ce perioadă. Aceste evidențe ajută analiza operațională. În pilot, condițiile de facturare și plată sunt convenite contractual; afișarea unui cost nu înseamnă debitare automată și nu înlocuiește documentele fiscale.",
  ],
  [
    "Parteneri verificați",
    "Partenerii sunt analizați în raport cu serviciile, zonele și capacitatea declarată înainte de activare. Lucrările au responsabili și un istoric care ajută evaluarea colaborării. Eligibilitatea nu reprezintă promisiunea unui număr nelimitat de echipe sau a unei intervenții garantate la orice oră; disponibilitatea se confirmă pentru serviciul concret.",
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
              "Completezi zona, numărul de proprietăți, utilizarea lor și volumul estimat de lucrări. Echipa analizează compatibilitatea cu serviciile și acoperirea pilotului. Trimiterea formularului nu activează automat un cont operațional și nu confirmă prețul; aceste elemente se clarifică înainte de colaborare.",
            ],
            [
              "Configurăm proprietățile și regulile",
              "După acceptarea portofoliului, sunt stabilite proprietățile, serviciile recurente, persoanele autorizate și regulile de aprobare. Instrucțiunile de lucru trebuie să descrie concret ce este necesar la fiecare spațiu. Condițiile de acces și informațiile sensibile sunt comunicate numai prin fluxul autorizat.",
            ],
            [
              "Confirmăm bugetul și alocăm lucrările",
              "Lucrarea este analizată în raport cu serviciul solicitat, bugetul și disponibilitatea partenerilor. Costurile care necesită decizie sunt trimise persoanei autorizate. După acceptarea alocării, partenerul primește detaliile necesare execuției, în limitele de acces aplicabile lucrării.",
            ],
            [
              "Verificăm și documentăm execuția",
              "Execuția este însoțită de checklist, observații și fotografii relevante. Documentele sunt revizuite pentru a vedea dacă răspund cerinței. Când lipsesc dovezi sau apar neconcordanțe, sunt cerute clarificări ori remedieri. O revizuire a documentelor nu echivalează cu o inspecție fizică.",
            ],
            [
              "Verifici costurile finale și primești raportul",
              "La încheiere, poți consulta rezultatul, costurile înregistrate și istoricul lucrării. Acest context ajută la identificarea problemelor care se repetă și la planificarea intervențiilor viitoare. Facturarea urmează condițiile convenite; pilotul nu activează plăți automate Pro.",
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
  [
    "Administratori de apartamente în regim hotelier",
    "Organizezi intervențiile dintre sejururi, verificările și consumabilele pe fiecare apartament. Programările din pilot se gestionează manual, cu responsabil și istoric pentru fiecare lucrare."
  ],
  [
    "Operatori de short-term rental",
    "Urmărești serviciile recurente și problemele raportate într-un singur portofoliu. Confirmi separat disponibilitatea și programarea; pilotul nu include sincronizare cu Airbnb sau Booking."
  ],
  [
    "Agenții de administrare proprietăți",
    "Separi evidențele proprietăților și distribui responsabilitățile între persoanele autorizate. Poți urmări lucrările, dovezile și costurile fără să pierzi legătura cu spațiul la care se referă."
  ],
  [
    "Investitori cu minimum 5 proprietăți",
    "Centralizezi informațiile operaționale pentru a înțelege unde apar intervenții și costuri. Activarea depinde și de acoperire și servicii, nu doar de numărul de proprietăți."
  ],
  [
    "Aparthoteluri și unități de cazare",
    "Definești cerințe recurente și verificări pe spațiile gestionate. Serviciile și intervalele se stabilesc înainte de activare, în funcție de capacitatea disponibilă și de nevoile locației."
  ],
  [
    "Proprietari care gestionează de la distanță",
    "Primești contextul lucrărilor prin observații, dovezi și istoric. Controlul documentar ajută urmărirea activității, dar nu înlocuiește o vizită fizică atunci când aceasta este necesară."
  ]
].map(([t, description]) => (
            <div className="pro-card" key={t}><h3>{t}</h3><p>{description}</p></div>
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
            "Pilotul este destinat portofoliilor de minimum 5 proprietăți din zone eligibile. Numărul de proprietăți este doar un criteriu: se analizează și zona, tipul spațiilor, serviciile necesare și volumul estimat. Completează formularul cu date realiste. Pentru o singură proprietate sau o intervenție ocazională, poți folosi rezervarea standard de curățenie.",
          ],
          [
            "Cum se plătesc serviciile?",
            "Condițiile și circuitul de facturare se stabilesc contractual înainte de activare. Nu sunt disponibile plăți automate Pro în pilot. Sumele din evidența operațională ajută la urmărirea lucrărilor, dar nu reprezintă confirmări de debitare sau documente fiscale. Clarificăm serviciile, regulile de aprobare și responsabilitățile înainte de începerea colaborării.",
          ],
          [
            "Pot folosi platforma de pe telefon?",
            "Da, interfața web este adaptată telefonului și poate fi accesată din browser. Funcțiile afișate depind de rolul și portofoliul activat. Ai nevoie de conexiune pentru a trimite modificări și dovezi; nu considera o acțiune înregistrată până când primești confirmarea. Nu este necesar să aștepți publicarea unei aplicații într-un magazin pentru a folosi interfața web.",
          ],
          [
            "Ce înseamnă verificare?",
            "Checklistul și fotografiile sunt revizuite documentar. Verificarea la proprietate este un serviciu stabilit separat. Revizuirea urmărește dacă informațiile trimise documentează lucrarea și dacă există neconcordanțe. Când dovezile sunt insuficiente, pot fi necesare clarificări; o fotografie nu dovedește automat toate aspectele calității sau stării unui spațiu.",
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
