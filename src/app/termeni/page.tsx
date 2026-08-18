import { LegalPage } from "@/components/LegalPage";

export default function TermeniPage() {
  return (
    <LegalPage title="Termeni și condiții" updated="16 august 2026">
      <section>
        <h2>1. Despre Nitido</h2>
        <p>
          Nitido este o platformă online (&quot;Platforma&quot;) care intermediază între persoane
          fizice sau juridice care au nevoie de servicii de curățenie (&quot;Client&quot;) și
          firme de curățenie înregistrate pe platformă (&quot;Firmă&quot;). Nitido nu prestează
          servicii de curățenie și nu este parte în contractul de prestări servicii încheiat
          între Client și Firmă — rolul platformei este de a facilita conectarea, comunicarea și
          plata dintre cele două părți.
        </p>
      </section>

      <section>
        <h2>2. Contul de utilizator</h2>
        <p>
          Pentru a folosi Platforma, atât Clienții cât și Firmele trebuie să creeze un cont,
          furnizând date reale și complete. Firmele trebuie să furnizeze suplimentar codul unic de
          înregistrare (CUI) și zona de acoperire în care operează. Fiecare utilizator este
          responsabil pentru confidențialitatea datelor de autentificare ale propriului cont.
        </p>
      </section>

      <section>
        <h2>3. Postarea și acceptarea lucrărilor</h2>
        <p>
          Clientul postează o lucrare specificând adresa, tipul de spațiu și suprafața. Prețul
          este calculat automat și afișat înainte de confirmarea postării. Firmele eligibile din
          zonă primesc o alertă instant; prima Firmă care acceptă preia lucrarea. Odată acceptată,
          confirmarea implică angajamentul Firmei de a se prezenta la adresa și ora convenite.
        </p>
      </section>

      <section>
        <h2>4. Plata</h2>
        <p>
          Plata se procesează prin Stripe, procesator de plăți terț. La acceptarea lucrării, suma
          este autorizată (rezervată) pe cardul Clientului, fără a fi debitată efectiv. Debitarea
          are loc abia după confirmarea finalizării lucrării. Platforma reține un comision din
          suma încasată de Firmă, ca remunerație pentru serviciul de intermediere; suma afișată
          Firmei la acceptare reprezintă deja valoarea netă, după comision.
        </p>
      </section>

      <section>
        <h2>5. Anulare și neprezentare (no-show)</h2>
        <p>
          Dacă Firma nu confirmă prezența la locație în intervalul stabilit după ora programată,
          Platforma marchează automat lucrarea ca neonorată, anulează rezervarea de plată (fără
          nicio sumă reținută de la Client) și aplică un sistem de avertismente/suspendare
          Firmei responsabile, proporțional cu numărul de abateri.
        </p>
      </section>

      <section>
        <h2>6. Evaluări</h2>
        <p>
          După finalizarea unei lucrări, Clientul poate evalua Firma printr-un rating public.
          Evaluările reflectă exclusiv opinia Clientului și nu reprezintă o poziție a Platformei.
        </p>
      </section>

      <section>
        <h2>7. Limitarea răspunderii</h2>
        <p>
          Nitido acționează exclusiv ca intermediar tehnic între Client și Firmă. Calitatea,
          execuția și orice eventuale daune rezultate din prestarea efectivă a serviciului de
          curățenie sunt responsabilitatea exclusivă a Firmei care a acceptat lucrarea. Nitido nu
          garantează și nu răspunde pentru rezultatul serviciilor prestate de Firme.
        </p>
      </section>

      <section>
        <h2>8. Date cu caracter personal</h2>
        <p>
          Prelucrarea datelor cu caracter personal este descrisă în{" "}
          <a href="/confidentialitate" className="text-aqua-deep underline">
            Politica de confidențialitate
          </a>
          .
        </p>
      </section>

      <section>
        <h2>9. Modificarea termenilor</h2>
        <p>
          Acești termeni pot fi actualizați periodic. Continuarea folosirii Platformei după o
          actualizare reprezintă acceptarea noilor termeni.
        </p>
      </section>

      <section>
        <h2>10. Contact</h2>
        <p>Pentru întrebări legate de acești termeni, ne poți scrie la contact@nitido.ro.</p>
      </section>
    </LegalPage>
  );
}
