import { LegalPage } from "@/components/LegalPage";

export default function ConfidentialitatePage() {
  return (
    <LegalPage title="Politica de confidențialitate" updated="16 august 2026">
      <section>
        <h2>1. Ce date colectăm</h2>
        <p>
          Colectăm datele pe care ni le furnizezi direct: nume, email, telefon (opțional), și,
          pentru Firme, CUI și zona de acoperire. Pentru fiecare lucrare postată, colectăm adresa
          locației, tipul de spațiu, suprafața și, opțional, poze ale spațiului. Datele de plată
          (numărul cardului) sunt procesate direct de Stripe — Nitido nu stochează niciodată
          datele complete ale cardului.
        </p>
      </section>

      <section>
        <h2>2. Scopul prelucrării</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Crearea și administrarea contului tău</li>
          <li>Conectarea Clienților cu Firmele eligibile pentru o lucrare</li>
          <li>Procesarea plăților prin Stripe</li>
          <li>Comunicări legate de statusul unei lucrări</li>
          <li>Respectarea obligațiilor legale (facturare, evidență contabilă)</li>
        </ul>
      </section>

      <section>
        <h2>3. Temei legal</h2>
        <p>
          Prelucrăm datele în baza executării contractului dintre tine și Nitido (crearea contului,
          folosirea platformei), a consimțământului (pentru comunicări opționale) și a obligațiilor
          legale aplicabile.
        </p>
      </section>

      <section>
        <h2>4. Partajarea cu terți</h2>
        <p>
          Partajăm date strict cu furnizorii necesari funcționării platformei: Stripe (procesare
          plăți) și furnizorul de găzduire a serverelor. Adresa locației unei lucrări este
          partajată cu Firma care acceptă acea lucrare — este necesar pentru executarea
          serviciului. Nu vindem și nu închiriem datele tale către terți în scopuri de marketing.
        </p>
      </section>

      <section>
        <h2>5. Perioada de stocare</h2>
        <p>
          Păstrăm datele contului cât timp acesta este activ. Datele legate de tranzacții
          (lucrări, plăți) sunt păstrate conform obligațiilor legale de arhivare fiscală/contabilă
          aplicabile în România.
        </p>
      </section>

      <section>
        <h2>6. Drepturile tale</h2>
        <p>
          Conform Regulamentului General privind Protecția Datelor (GDPR), ai dreptul de acces,
          rectificare, ștergere, restricționare a prelucrării, portabilitate a datelor și opoziție
          față de prelucrare. Pentru a exercita oricare dintre aceste drepturi, ne scrii la
          contact@nitido.ro.
        </p>
      </section>

      <section>
        <h2>7. Securitate</h2>
        <p>
          Parolele sunt stocate criptat (hash), niciodată în clar. Comunicarea cu platforma se
          face exclusiv criptat (HTTPS). Accesul la datele stocate este restricționat la personalul
          necesar operării platformei.
        </p>
      </section>

      <section>
        <h2>8. Contact</h2>
        <p>
          Pentru orice întrebare legată de datele tale personale, ne poți scrie la
          contact@nitido.ro.
        </p>
      </section>
    </LegalPage>
  );
}
