# A2 — Rezervare asistată și alocare atomică

Continuă PR63. Pachet pentru sandbox, fără deploy LIVE sau publicare în magazinele mobile.

## Fluxul implementat

Admin leagă oferta acceptată de revizia curentă a planului operațional și propune o echipă eligibilă, cu termen explicit pentru confirmare. Interfața prezintă firma, echipa, ora, durata și rezerva de deplasare. Clientul confirmă exact această revizie, programarea și prețul înainte de crearea lucrării în așteptare. Lucrarea păstrează fotografia imutabilă a planului confirmat. Propunerea și crearea lucrării nu rezervă capacitate și nu autorizează plata.

La acceptarea de către firma propusă, acceptJobAtomic reverifică eligibilitatea și capacitatea, schimbă starea lucrării și scrie alocarea echipei și auditul în aceeași tranzacție SQLite BEGIN IMMEDIATE. Se aplică suprapunerile conservatoare la nivel de firmă, perioadele indisponibile ale echipei și maximele dintre duratele/deplasările confirmate și minimele curente ale echipei. Disponibilitatea invalidă nu este interpretată drept timp liber. Două lucrări în așteptare pot avea același interval; numai una poate fi acceptată dacă intervalele se suprapun.

Autorizarea existentă a plății are loc după commit. Dacă aceasta eșuează, compensarea protejată de tokenul încercării readuce lucrarea în așteptare și eliberează numai alocarea încercării respective, într-o tranzacție. O eroare întârziată a unei încercări vechi nu eliberează alocarea unei încercări noi. Funcțiile furnizorului de plăți, cheile, conturile și webhookurile nu sunt schimbate.

## Acces, istoric și compatibilitate

Propunerea operațională se scrie prin endpoint Admin verificat, cu control de origine, revizii concurente și audit atomic. Se păstrează restricțiile existente pentru flagurile sandbox și lipsa cheilor Stripe live. Motivele interne și actorii Admin nu intră în fotografia publică.

Oferta, planul și programarea trebuie să fie actuale la confirmarea clientului. Modificările ulterioare ale evaluării nu rescriu lucrarea deja confirmată. Reverificarea echipei și a capacității are loc în continuare la acceptare. Numai firma selectată vede oportunitatea asistată în lista de lucrări disponibile; notificările se direcționează către aceasta. Schimbarea obișnuită a echipei este refuzată pentru aceste lucrări; reconfirmarea unei alte echipe necesită un flux explicit separat.

Renovările și suprafețele mari pot folosi oferta asistată și durata evaluată pentru o singură echipă. Renovarea necesită aceeași verificare foto valabilă ca în oferta acceptată. Prețurile confirmate trebuie să rămână reprezentabile în fluxul financiar existent; ofertele cu reduceri sau valori incompatibile ale remunerației prestatorului nu sunt activate prin acest pachet. Limita existentă de 200 m² pentru geamuri rămâne aplicabilă.

## Limite

Modelul de execuție are o echipă pe lucrare. Planurile cu mai multe echipe nu sunt executabile prin acest flux. Nu se inventează ture sau calendare nocturne și nu se relaxează regula conservatoare pe firmă. Propunerile expirate nu devin automat ASAP. Nu există încă un flux de înlocuire a echipei după confirmarea clientului.

## Verificare

Suita test:upgrade:a2-allocation cuprinde 517 teste în 39 fișiere. Cele 17 teste noi folosesc endpointurile reale și SQLite: renovare/suprafață mare, fotografie a duratei, două conexiuni concurente, firmă greșită, eligibilitate schimbată, blocare apărută după propunere, revizii și expirare, acces/CSRF, rollback la audit, eșecul autorizării și tokenul unei încercări noi. Concurența se verifică ținând prima autorizare în așteptare după commit și încercând acceptarea celeilalte lucrări pe a doua conexiune.

Validarea locală include UTC și Europe/Bucharest, Next typegen, TypeScript și ESLint țintit. Plățile sunt simulate în teste; nu sunt declarate tranzacții Stripe reale, verificare 3DS sau verificare vizuală pe mobil. Verificarea în browserul sandbox rămâne restantă din cauza blocajului de acces documentat anterior. CI-ul PR63 era verde înaintea acestei etape.

## Revenire

Se păstrează tabelele și istoricul imutabil assisted_offer_plans și assisted_job_plans. Dezactivarea creării de oferte/rezervări sandbox nu elimină obligațiile lucrărilor deja create. Nu se revine la un acceptJobAtomic vechi cât timp există lucrări asistate active: ar dispărea verificarea firmei și alocarea echipei. Revenirea necesită păstrarea verificărilor compatibile sau soluționarea explicită a acestor lucrări înainte de retragerea codului. Nu se șterg fotografii, alocări sau istoricul pentru a forța rollbackul.
