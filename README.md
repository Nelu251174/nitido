# Nitido — MVP funcțional

Implementare reală (nu doar demo static) a specificației din `nitidospecprogramator.md`,
construită ca aplicație web Next.js. Rulează, se testează și se poate demonstra cap-coadă
chiar acum, în acest workspace — cu conturi reale, nu doar date demo.

## Ce e deja funcțional, verificat live

- **Autentificare reală** (`/signup`, `/login`) — cont client sau firmă, parolă hash-uită
  (bcrypt), sesiune pe cookie httpOnly. Firma se înregistrează cu CUI + zonă de acoperire
  (spec secțiunea 4.1).
- **Postare lucrare** (`/client`) — formular complet (adresă, etaj, mp, tip spațiu, "cât mai
  curând" / programare pe dată+oră), preț calculat exact pe treptele din spec (secțiunea 6).
- **Upload real de poze** — imaginile ajung pe disk (`public/uploads`), sunt legate de
  lucrare la postare și afișate firmei în cardul de alertă (spec secțiunea 3, punct 2).
- **Alertă către firme + acceptare** (`/firma`) — panou cu alerte live (polling 2s), buton
  „Accept", sumă netă afișată firmei fără mențiune de comision (spec secțiunea 7).
- **Mecanismul „primul care apasă câștigă"** (spec secțiunea 5) — implementat cu un
  `UPDATE ... WHERE status = 'waiting'` atomic, condiționat, în `src/lib/acceptJob.ts`.
  **Verificat live cu 3 firme lovind simultan același job prin `curl` în paralel — exact una
  a câștigat, celelalte 2 au primit 409.** Testat și automat: `src/lib/acceptJob.test.ts`
  simulează 10 firme concurente, exact una câștigă.
- **Blocare calendar firmă** (spec secțiunea 5d) — o firmă nu poate accepta o lucrare care
  se suprapune cu una deja acceptată de ea (durată calculată din mp + buffer 30 min).
- **Status live cross-tab** — clientul vede automat, fără refresh, când firma acceptă,
  ajunge la fața locului și finalizează (polling 2s pe `/api/jobs/:id`).
- **Rating firmă** (spec secțiunea 5c) — stele obligatorii + 3 criterii opționale, agregat
  pe profilul firmei.
- **No-show + strike-uri, complet automat** (spec secțiunea 5b) — un scanner in-process
  (`src/lib/noShowScheduler.ts`, pornit din `src/instrumentation.ts` la boot-ul serverului)
  verifică la fiecare 30s lucrările acceptate a căror oră a trecut de pragul de grație fără
  confirmare "am ajuns" și le marchează no-show automat — **verificat live**: am dat orei
  programate a unei lucrări o valoare în trecut și am văzut statusul trece singur pe
  `no_show` la următorul tick, fără niciun apel manual. Praguri 1/2/3+ implementate exact
  ca în spec, cu suspendare temporară/permanentă și opțiune de repostare pentru client.
- **Plăți — cod Stripe Connect real, activat automat** (`src/lib/payments.ts`) — dacă
  `STRIPE_SECRET_KEY` există în mediu, se fac apeluri reale (`paymentIntents.create` cu
  `capture_method: manual` = hold, `capture`, `cancel`, split 18%/82% prin
  `application_fee_amount` + `transfer_data.destination`). Fără cheie, cade automat pe
  stub-ul local (scrie direct în tabelul `payments`) — restul aplicației (accept, finalizare,
  no-show) nu se schimbă deloc între cele două moduri. Dacă autorizarea Stripe eșuează,
  acceptarea lucrării se anulează automat (rollback pe `waiting`), ca un client să nu rămână
  cu o lucrare "acceptată" fără nicio plată autorizată în spate.
- **Panou admin minimal** (`/admin`) — lucrări, firme (rating, strike-uri, suspendări),
  plăți, plus declanșare manuală de no-show pentru testare (pe lângă cea automată).
- **Design system** aplicat exact ca în spec (secțiunea 9): culori mist/ink/aqua/coral/line,
  fonturi Sora + Inter (auto-hostate local, fără request către Google Fonts).
- **38 de teste automate** (`npx vitest run`) — calcul preț/durată pe fiecare treaptă din
  spec, praguri no-show și efectele lor (strike, suspendare, anulare plată, repostare),
  hash/verificare parolă, și concurența pe mecanismul de acceptare.
- **Build de producție verificat** — `npx next build` trece curat, TypeScript strict fără
  erori, ESLint fără erori.

## Cum rulezi local

```bash
npm install
npm run dev
```

Deschide `http://localhost:3000` (sau portul ales). La prima pornire se creează automat
`data/nitido.db` (SQLite). Intră pe `/signup` și creează un cont de client și unul de firmă
(în aceeași zonă/oraș, ca alerta să ajungă la firmă) — nu mai există date demo pre-populate,
totul trece prin înregistrare reală.

Pentru un test real al mecanismului de acceptare: autentifică-te ca client într-un tab și ca
firmă în alt tab (sau alt browser) — postează o lucrare, apoi acceptă din tabul de firmă.
Tabul de client se actualizează singur.

## Ce s-a substituit deliberat față de spec — și de ce

Specificația (secțiunea 10) recomandă **React Native (Expo)** ca frontend. Cererea inițială
a lui Nelu în această conversație a fost explicit pentru un **website**, așa că am implementat
o aplicație **Next.js** responsive (funcționează perfect și pe mobil, în browser) — compatibilă
și cu instalare ca PWA mai târziu, dacă vreți experiență de "aplicație" fără store. Dacă
varianta React Native nativă rămâne necesară (pentru push notifications native, de exemplu),
logica din `src/lib/` (preț, durată, mecanismul de acceptare, strike-uri, plăți) e portabilă
1:1 — nu depinde de Next.js.

Specificația recomandă **PostgreSQL + Prisma**. Acest workspace blochează rețeaua către
`binaries.prisma.sh` (unde Prisma își descarcă engine-ul), așa că am folosit
**SQLite + better-sqlite3** — sintaxă SQL aproape identică, migrare la Postgres e o schimbare
mică (schema e SQL simplu, fără feature-uri specifice SQLite, în `src/lib/db.ts`).

Detectarea de no-show rulează ca **scanner in-process** (`setInterval`, pornit din
`instrumentation.ts`), nu ca job de cron extern. Funcționează perfect cât timp serverul
rulează continuu (cum rulează acest workspace, sau orice hosting clasic Node). **Pe hosting
serverless (Vercel), un proces long-running nu supraviețuiește între cereri** — acolo,
`runNoShowScan()` din `src/lib/noShowScheduler.ts` trebuie apelată dintr-un **Vercel Cron**
(sau alt scheduler extern), nu lăsată pe interval intern. Codul e deja structurat pentru asta:
`runNoShowScan()` e o funcție de sine stătătoare, ușor de expus și ca rută API apelabilă de cron.

## Ce NU e funcțional încă — are nevoie de deciziile/credențialele tale

1. **Cont Stripe Connect real** — codul e gata (vezi mai sus), dar fără `STRIPE_SECRET_KEY`
   în mediu rulează pe stub. Ai nevoie de: cont Stripe Connect, cheia respectivă, și fluxul
   de onboarding Connect pentru firme (ca fiecare firmă să aibă `stripe_account_id` —
   coloană deja pregătită în `firms`, dar fără UI de onboarding construit încă).
1b. **SMS de sosire (Twilio)** — cod gata (`src/lib/sms.ts`), feature-flag pe
   `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` (vezi `.env.example`).
   Fără chei, e no-op — restul fluxului (marcarea „Am ajuns") merge normal, doar SMS-ul nu
   pleacă. Când firma apasă „Am ajuns / Lucrare începută", se trimite automat un SMS către
   telefonul clientului (câmp opțional la înregistrare — dacă lipsește, se sare peste, fără
   eroare). Cont Twilio: https://www.twilio.com/try-twilio.
2. **Push notifications reale** — alertele către firme funcționează prin polling (2 secunde),
   nu prin push instant. Pentru alertă instantă reală ai nevoie de OneSignal sau Firebase
   Cloud Messaging (cont + chei), cum recomandă spec-ul.
3. **Verificare CUI firmă** — câmpul există la înregistrare, dar nu există validare automată
   contra unui registru real (ONRC/ANAF) — firmele noi sunt marcate verificate automat ca
   MVP-ul să rămână testabil cap-coadă fără integrare externă.
4. ~~**Domeniu final**~~ — **rezolvat**: `nitido.ro` a fost cumpărat. `metadataBase` și
   Open Graph în `src/app/layout.tsx` sunt deja setate pe `https://nitido.ro` (suprascriere
   posibilă din `NEXT_PUBLIC_SITE_URL`, vezi `.env.example`). Mai rămâne doar să legi
   domeniul de proiectul din Vercel, după deploy (pasul 5).
5. **Hosting de producție** — codul e gata de deploy pe Vercel (frontend) + orice provider
   Postgres (Supabase, Neon, Railway) după migrarea de la SQLite; scanner-ul de no-show
   trece pe Vercel Cron (vezi mai sus). După primul deploy, legi `nitido.ro` de proiect din
   Vercel → Settings → Domains.
6. **Stocare poze persistentă** — momentan pe disk local (`public/uploads`), suficient pentru
   acest workspace, dar volatil pe hosting serverless. Pentru producție ai nevoie de S3,
   Cloudinary sau similar.

## Structura proiectului

```
src/
  lib/
    pricing.ts          — preț, durată, sloturi, suprapuneri (funcții pure, testate)
    strikes.ts           — praguri no-show → consecințe
    acceptJob.ts          — mecanismul atomic "primul câștigă" (testat pentru concurență)
    noShow.ts              — efectele no-show (strike, suspendare, anulare plată, repost)
    noShowScheduler.ts      — scanner automat in-process (vezi nota despre serverless mai sus)
    payments.ts              — autorizare/capturare/anulare plată (Stripe real sau stub)
    auth.ts                   — hash parolă, sesiuni, cookie
    db.ts                      — schemă SQLite
  instrumentation.ts        — pornește scanner-ul de no-show la boot-ul serverului
  app/
    page.tsx              — pagina de start
    login/, signup/         — autentificare
    client/page.tsx           — flux client (postare, upload poze, status live, rating)
    firma/page.tsx              — flux firmă (alerte, accept, panou comenzi)
    admin/page.tsx                — panou minim de administrare/verificare
    api/                            — toate rutele backend
```

## Teste

```bash
npx vitest run
```

38 de teste — preț/durată pe fiecare treaptă din spec, hash/verificare parolă, praguri
no-show cu toate efectele lor, și un test explicit de concurență (10 firme simultane,
exact una câștigă lucrarea).
