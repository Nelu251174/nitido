# Continuare NITIDO v1.1 după PR #85 — raport de etapă

Data: 09.10.2026. Bază exactă: `4c8315148504bc2edd98a5d9b155763db987b339`. Candidat: `codex/nitido-v11-completion`.

## Ce este verificat și modificat

Brieful v1.1 a fost citit integral, inclusiv amendamentele A–H, și păstrat în `MASTER-BRIEF-v1.1.md`. Istoricul Work recuperat și inventarul PR #85 au fost confruntate cu sursa. Rolurile nominale, regulile foto, dashboardul inițial și rezoluțiile incidentelor din PR #85 se păstrează; nu sunt implementate din nou.

Această continuare completează delegarea CRM/Pro, recurența Pro zilnică și migrarea 14, registrul invitațiilor trimise confirmate, definițiile KPI și Provider Score configurabil numai în observare. Tema crem și verdele acțiunilor se păstrează. Overflow-ul formularului de capacitate la 768 px a fost corectat prin minime/lățimi CSS, verificat apoi în browser. Nu se schimbă arhitectura sau configurarea Stripe și nu se inventează ponderi comerciale, prețuri, TVA ori praguri de marjă.

S-au remediat ciclul real de import al inițializării push, intervalele negative mascate de agregarea capacității și guard-ul de migrare care confunda `provider_*` cu `pro_*`. Fixture-urile existente folosesc inițializarea reală a bazei, iar verificările editoriale/AI urmăresc contractele deja implementate. Nu au fost omise teste sau înlăturate validări financiare pentru a obține PASS.

## Rezultate locale

| Probă | Rezultat | Limită |
|---|---|---|
| Baseline PR #85, git archive exact | 1.510/1.592 PASS, 82 eșecuri și import push necolectat | Reprodus în UTC; nu stare LIVE |
| Toată suita Vitest, UTC | 1.661/1.661 PASS în 151 fișiere, fără teste omise | Integrările externe sunt simulate |
| Toată suita Vitest, Europe/Bucharest | 1.661/1.661 PASS în 151 fișiere, fără teste omise | Calendar/DST verificate fără dispozitive fizice |
| Toate scripturile Node | 38/38 PASS | Backup/restaurare SQLite și fotografii sintetice, nu volumele hostului |
| Typegen, TypeScript, build Webpack cu Pro activ | PASS, exit 0, 144 pagini generate | Nu dovedește imaginea instalată în Coolify |
| ESLint pe fișierele TS/TSX/MJS modificate | 54 fișiere, zero erori/avertismente | Nu se declară lint global al repository-ului |
| Scripturile de migrare împachetate 13→14 | PASS, 27 tabele precedente și snapshoturi păstrate, reexecutare idempotentă, integritate/FK valide | Exclusiv bază sintetică în /tmp |
| Compatibilitate aplicație mobilă existentă | 122/122 teste în 13 fișiere, TypeScript PASS; fără schimbări mobile | Nu dispozitive reale, binar sau distribuție în magazine |
| Browser autentificat | 20/20 verificări funcționale și 60/60 layouturi PASS; zero erori JS. Patru roluri cu MFA, viewer cu scope, foto, scor în observare și daily create/pause/resume | Local Chromium, nu sandbox/telefoane fizice |

Dovezile compacte fără credențiale sunt în `qa/`. Matricea celor 82 de eșecuri inițiale și cauzele sunt în `A0-FULL-SUITE-STABILIZATION.md`. Ultima modificare echivalentă de redacție CRM a fost reverificată țintit în ambele fusuri, iar buildul final include sursa corectată. CI rulează toată suita în ambele fusuri, toate scripturile și buildul pe același candidat; are numai `contents: read` și nu declanșează deploy.

## Starea integrării și publicării

| Nivel | Stare verificată |
|---|---|
| Implementare | În ramura candidat, peste PR #85; modulele precedente păstrate |
| Testare locală | Probele de mai sus; acceptanța pe infrastructură rămâne distinctă |
| `main` | `2101988542d989b46cb2c091922d16ddce334387`, fără aceste modificări; merge neexecutat |
| Sandbox | Ultima dovadă istorică: `66ab204`, migrare Pro 12. Starea curentă nu poate fi confirmată în această sesiune; fără deploy nou |
| LIVE | Ultima sursă documentată: `fix/windows-area-clear` / `9cbc593`. Starea curentă neverificată; fără deploy nou |
| TestFlight / Google Play | Nu s-a încărcat sau distribuit un build nou în această etapă |

Ramura de producție documentată anterior este deja strămoș al PR #85 (`0/37` în comparația Git), prin istoricul care include integrarea `59528ff`; compose-ul de producție este păstrat. Aceasta dovedește corespondența sursei istorice, nu SHA-ul instalat azi.

## Ce rămâne deschis

- Accesul operabil la Coolify, sandbox și LIVE: domeniile sunt blocate de politica HTTP (`CONNECT 403` înainte de autentificare); sesiunea/tokenul și accesul la volume nu sunt configurate în mediul curent. GitHub funcționează.
- Confirmarea SHA-ului și imaginii instalate, backup/restaurare SQLite + uploads pe infrastructură, rollback verificat, migrările 13–14, conturi nominale cu MFA și probe Standard/Express/Pro pe sandbox.
- Checkout/3DS/webhook/refund pe configurația Stripe de test aprobată, concurență pe mediul țintă și compatibilitate pe iOS/Android fizic. Testele simulate nu închid aceste probe.
- Politicile comerciale/fiscale și pilotul: nicio valoare nouă nu este activată implicit. Provider Score rămâne în observare. Distribuția graduală Express după scor și expirarea invitațiilor nu sunt implementate în această continuare; politica operațională trebuie validată.
- Conversia exactă «comenzi confirmate / cereri eligibile» rămâne indisponibilă deoarece istoricul nu păstrează distinct eligibilitatea tuturor cererilor; conversia descriptivă și limita sunt afișate explicit. Nu s-a introdus un backfill fictiv.
- P1/P2 din inventar: SLA automatizate, segmentare, dashboard Pro consolidat, exporturi avansate și facturare/integrări contabile. Nu sunt prezentate drept lipsuri rezolvate prin acest PR.

Brieful nu este închis integral prin testele locale. Merge, deploy și probele operaționale au stări distincte. Pentru continuarea publicării trebuie configurat accesul securizat la mediile existente; nu este necesară repetarea aprobării pentru corecțiile tehnice deja solicitate.
