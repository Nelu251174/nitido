# NITIDO — acces infrastructură și acceptanță locală

Data verificării: 09.10.2026. Acest document separă probele locale de instalarea pe infrastructură.

## GitHub și Coolify

Coolify este documentat la `https://coolify.nitido.ro` în `docs/NITIDO-STAGING-20260913.md`. Sandboxul public este `https://sandbox.nitido.ro`; producția este `https://nitido.ro`.

În mediul cloud curent, observațiile sunt actuale, instanța este pornită și politica de rețea restricționată este aplicată. Nu sunt configurate secrete, variabile runtime sau identități outbound. VPN este dezactivat, fără destinații TCP permise. Cele trei domenii NITIDO nu apar în lista HTTP permisă. Cererile prin proxy au eșuat; verificarea suplimentară din sesiunea principală a primit refuz explicit `CONNECT 403` pentru Coolify. Acesta este un blocaj de rețea, nu o probă că autentificarea Coolify a fost respinsă. Nu au fost afișate valori de secrete și nu au fost schimbate configurații.

`deploy.yml` declanșează webhookul Coolify prin secretele GitHub `COOLIFY_WEBHOOK` și `COOLIFY_TOKEN` la push pe `feat/design-handoff-website-mobile-v2`, sau manual. Existența workflow-ului nu confirmă disponibilitatea secretelor ori ținta lui. Nu a fost executat pentru această verificare.

Instalările documentate anterior rămân dovezi istorice. În special, sursa producției confirmată la 24.09.2026 era `fix/windows-area-clear` / `9cbc59357c0a6b0aa29e91cdfb8d69c3de97ff35`. Verificarea Git actuală a sesiunii principale confirmă că acest commit este strămoș al candidatului PR #85: `git rev-list --left-right --count` indică `0 37`. Reconcilierea din `59528ff` păstrează istoricul și `docker-compose.production.yml`. Constatarea veche despre cele 61 de commituri divergente preceda această reconciliere. Aceasta verifică istoricul Git; sursa și imaginea LIVE actuale rămân necunoscute fără acces Coolify.

## Verificare browser izolată

`scripts/qa-local-browser.mjs` pornește o copie temporară a aplicației cu SQLite sintetic separat. `NITIDO_QA_BUILD_PATH=/workspace/nitido/.next` selectează copia izolată a buildului de producție și `next start`; fără această variabilă, rulează `next dev`. Folosește Chromium instalat local și `playwright-core` instalat într-un director separat, fără schimbarea dependențelor aplicației. Autentificarea administrativă trece prin endpointul real cu parolă și TOTP generate numai pentru acea rulare. Sesiunea utilizatorului Pro viewer este creată în fixture local și este etichetată distinct; nu dovedește un parcurs de login client.

Scriptul verifică permisiuni HTTP pentru Operator, Manager, Financiar și Super Admin, accesul intern Pro și eliminarea câmpurilor sensibile, editorul regulilor foto, izolarea proprietăților unui viewer Pro și layouturile la 360, 390, 430, 768, 1024 și 1440 px. Browserul blochează cererile spre destinații externe. Configurația serviciilor externe nu este preluată în copie. Nu sunt executate plăți, trimiteri de mesaje ori schimbări pe infrastructură.

Verificările noi includ salvarea unei politici Provider Score prin formularul Manager și confirmarea `mode=observation`, `automaticAllocation=false`. Ponderile arbitrare ale fixture-ului se salvează exclusiv în SQLite temporar; nu reprezintă alegerea unei politici comerciale. În calendarul Pro, Managerul creează o regulă zilnică, o pune în pauză și o reia prin formularele reale, apoi stările sunt confirmate prin citire API. Această probă verifică administrarea regulii; cronul și generarea pe infrastructură trebuie validate separat.

Rezultat final: **20/20 verificări funcționale, 60/60 layouturi și zero erori JavaScript**, comandă încheiată cu exit 0. Rularea folosește buildul de producție `ozzIOUr4rE7_fxFObTJDE`, copiat după terminarea compilării TypeScript și a celor 144 de pagini. Raportul complet este în `/workspace/nitido-qa-results/report.json`, capturile PNG în același director, inclusiv `manager-daily-recurrence.png`. Nu s-au executat retry-uri de dezvoltare în această rulare de producție.

Cele 60 de layouturi acoperă pagina publică, panourile administrative pentru patru roluri, detaliile Pro pentru aceleași roluri și lista de proprietăți a viewerului Pro, fiecare la cele șase lățimi. Fundalul crem este păstrat, iar verificarea măsurată a lățimii documentului nu a identificat overflow orizontal. Capturile nu înlocuiesc verificarea tuturor stărilor componentei sau un test pe dispozitiv fizic.

Confirmări funcționale ale rulării finale:

- Login real prin parolă și TOTP pentru Operator, Manager, Financiar și Super Admin; identitatea și permisiunile endpointurilor au fost verificate după login.
- Pro intern: accesul Operatorului la costuri este refuzat și detaliul lui nu include estimarea financiară; proprietatea citită de Financiar nu include adresa, iar detaliul lucrării nu include checklistul. Detaliile se randează fără erori cu aceste payloaduri restrânse.
- Managerul salvează prin editor regula foto Marketplace cu minimum 2 fotografii la sosire și 3 la finalizare; GET confirmă revizia nouă în SQLite sintetic.
- Politica Provider Score este salvată prin formular; GET confirmă modul `observation` și `automaticAllocation=false`.
- Calendarul Pro creează regula `daily` și permite Pauză/Reia prin UI; API confirmă `active=1 → 0 → 1`, frecvența rămâne `daily`, fără apariții generate în această probă.
- Viewerul Pro vede doar proprietatea permisă, fără adresă; cealaltă proprietate și datele financiare sunt refuzate.

Rulările intermediare sunt păstrate în `prior-runs/`. Prima acceptanță completă pe build a trecut cele 18 verificări funcționale și 59 din 60 de dimensiuni; a identificat un overflow la 768 px în câmpurile de capacitate ale catalogului Super Admin. Corecția în `CatalogFirmCapacity` permite etichetelor și inputurilor să se restrângă în coloanele existente, fără schimbarea designului. Rularea finală confirmă dispariția acestui overflow. Rulările de dezvoltare au întâlnit erori tranzitorii de manifest Next; observațiile reconstruite din ieșirile comenzilor sunt etichetate ca atare, distincte de raportul complet al rulării de producție. Timeouturile selectorului Super Admin și așteptării `networkidle` sunt consemnate separat ca limitări ale versiunii inițiale a instrumentului QA.

Reproducere în mediul curent, după un build de producție reușit cu `NITIDO_PRO_ENABLED=true NEXT_PUBLIC_NITIDO_PRO_PUBLIC=true`:

```bash
npm install --prefix /workspace/nitido-qa-tools --cache /workspace/nitido-qa-tools/cache --ignore-scripts --no-audit --no-fund playwright-core
NITIDO_QA_BUILD_PATH=/workspace/nitido/.next node scripts/qa-local-browser.mjs
```

Pe alt mediu, `NITIDO_QA_PLAYWRIGHT`, `NITIDO_QA_CHROMIUM` și `NITIDO_QA_OUTPUT` permit alegerea modulului Playwright, a browserului și a directorului de probe. Scriptul nu modifică `package.json` sau baza de date a repository-ului.

Aceste verificări nu constituie acceptanță Coolify/sandbox/LIVE, verificare pe telefoane reale, integrare în `main`, publicare mobilă ori confirmarea rambursărilor Stripe. Pentru acestea trebuie reconfirmate sursa și imaginea instalată, volumele, backupul și restaurarea, migrările, configurația pe fiecare mediu și parcursurile autentificate pe mediul țintă.
