# A3 — Verificarea incidentelor

## Livrare

Extinde dosarele existente `visit_cases`, nu creează un al doilea sistem de incidente. Admin → Incidente (`/admin#incidente`) listează dosarele cu paginare de 50, descriere, fotografia atașată și istoricul răspunsurilor/remedierilor. Administratorul autentificat prin mecanismul MFA existent înregistrează: problemă confirmată, problemă neconfirmată sau informații suplimentare necesare, cu motiv obligatoriu.

Clientul și firma implicată văd concluziile în componenta existentă de instrucțiuni/recepție/remedieri, inclusiv `/remedieri`. Motivul este explicit prezentat administratorului ca vizibil părților. Identificatorul sesiunii administrative nu este expus în istoricul public al dosarului.

## Integritate

Tabela aditivă `visit_case_reviews` păstrează concluziile și autorul verificat. Triggerele refuză UPDATE/DELETE; corecțiile adaugă o înregistrare. Dosarele istorice fără verificări rămân „Neverificat”, inclusiv cele soluționate anterior. Instalarea repetată a schemei păstrează datele.

POST verifică sesiunea administrativă, originea, dimensiunea cererii, concluzia și motivul. Tranzacția IMMEDIATE salvează concluzia, noua versiune a dosarului și auditul administrativ împreună. Un audit eșuat anulează tot. Versiunea dosarului respinge modificările concurente, inclusiv răspunsurile ori soluționările bazate pe o versiune veche. O reîncercare cu versiunea veche primește 409; utilizatorul reîncarcă istoricul pentru a vedea dacă prima salvare a reușit.

Concluzia nu schimbă statusul remedierii sau execuției, prețul, plata, recepția, scorul, suspendarea ori alocarea. Nu produce rambursări. Fotografia folosește ruta privată existentă, care verifică accesul administrativ și accesul părților. Nu se impune retrospectiv o nouă dovadă obligatorie.

## Verificare

17 teste noi: autentificare administrativă, CSRF, autorul real, date invalide, concurență/reîncercare, audit atomic, istoric imuabil, paginare, izolarea clientului/firmei, păstrarea execuției/prețului/scorului și inițializare repetată. Comanda `npm run test:upgrade:a3-incidents` include regresia A0–A2; 546 teste / 42 fișiere trecute în UTC și Europe/Bucharest. Typegen și TypeScript trecute; ESLint pe fișierele noi trecut. Componenta VisitCare are o avertizare ESLint preexistentă tratată ca eroare (`set-state-in-effect`), în afara acestei schimbări.

## Validare sandbox rămasă

Publicare doar după selectarea branch/SHA în resursa sandbox. Această livrare nu este declarată LIVE și nu reprezintă un build TestFlight/Google Play. Verificarea browser a sandboxului nu a fost efectuată: accesul browser a fost blocat anterior explicit de politică și nu a fost ocolit.

După deploy: administratorul deschide `/admin#incidente`, selectează un dosar test existent, examinează dovezile și salvează o concluzie. Clientul și firma aferentă verifică rezultatul în `/remedieri`; un cont fără legătură nu trebuie să poată vedea dosarul. De verificat pe desktop și iOS/Android: selectorul, textele lungi, fotografia privată și istoricul. Datele de test și orice creare de dosar rămân în sandbox.

A3 rămâne în lucru: audit complet checklisturi/dovezi/eligibilitate, validare pe roluri și dispozitive, backup/restaurare. Solicitarea de informații este o concluzie vizibilă în dosar, nu un email/push nou. Nu există în acest pachet SLA, escaladări automate, notificări noi, praguri de penalizare sau scor activ nou. Snapshoturile financiare și contractuale existente rămân neschimbate.
