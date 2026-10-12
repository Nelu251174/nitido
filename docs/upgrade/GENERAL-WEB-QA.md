# NITIDO — audit general web înaintea pregătirii pentru magazine

Data: 9 octombrie 2026. Auditul păstrează designul aprobat și completează probele PR #87; nu reprezintă publicare în magazine, deploy sau acceptanță LIVE.

## Referințe exacte și probe reutilizate

Baseline verificat: `19047e8e1276167f49e0095674c67e911179068e`, ramura `codex/nitido-operational-completion`. CI verde al acestui SHA: [run 37911105458](https://github.com/Nelu251174/nitido/actions/runs/37911105458). Rezultatul baseline nu este atribuit automat modificărilor ulterioare.

| Probă baseline | Rezultat și identitate |
|---|---|
| Regresie completă web | 1743/1743 în UTC și Europe/Bucharest, 160 fișiere, fără eșecuri sau omiteri |
| Scripturi Node | 44/44 cu izolarea implicită |
| Build de producție | 148 pagini, TypeScript trecut; `BUILD_ID=OqRZN5ykbLZwD0UQ0Rxqn` |
| Browser operațional | 31/31 scenarii, 108/108 layouturi la 360/390/430/768/1024/1440 px, zero `pageErrors`, același BUILD_ID |
| HTTP Pro public | 8/8 canonical, Open Graph/Twitter, PNG și robots/sitemap; build `cblpbhbL1VxNNJNjzo7ws` anterior ultimei corecții responsive |
| HTTP Pro dezactivat | Build separat `xXjud4UYcu62z0E1ozqSh`, 5/5: cele trei pagini 404, sitemap fără Pro, marketplace indexabil |
| Docker baseline | Imagine `sha256:9e9aac72b38731c8c9db8a5473506a0cfbba99b6829842ecf50d9abaf794a74c`, UID1001/Node22, SQLite nativ, PNG local 1200×630 și simulator recovery fără rețea |

Surse ale probelor: `OPERATIONAL-COMPLETION-QA.md`, `qa/operational-browser-report.json`, `/tmp/nitido-qa/operational-final-{utc,bucharest}.json`, `/workspace/nitido-qa-public-http-results/` și `/workspace/nitido-docker-release-verified-evidence-20261009/`. Artefactele locale nu sunt dovezi de deployment sau tranzacții reale.

## Acoperirea fluxurilor

Harnessul suplimentar `scripts/qa-general-web.mjs` folosește un server Next de producție copiat în director temporar, SQLite și conturi sintetice. Elimină credențialele serviciilor externe, blochează solicitările browser către alte origini și nu efectuează plăți sau modificări în baza reală. Axe este instalat numai în uneltele QA, nu în dependențele aplicației.

| Utilizator / suprafață | Verificări efective |
|---|---|
| Public | Homepage, login, signup, resetare parolă, rezervare, contact și trei pagini publice Pro; răspuns HTTP, randare, JavaScript, responsive și axe WCAG A/AA/2.1 AA |
| Anonim | `/api/jobs`, `/api/collaboration`, `/api/pro/context`, `/api/admin/auth/me` protejate; redirecționarea `/client` păstrează destinația sigură |
| Client | Login real cu parolă, dashboard cu lucrare sintetică, proprietăți și mesaje; acces exclusiv la lucrările proprii |
| Firmă | Login real, dashboard, echipe/calendar, lucrare alocată; separarea accesului privat față de oportunități |
| Angajat | Cont client plus apartenență nominală `worker` la o echipă, conform modelului existent; `/echipa` arată lucrarea alocată, iar lista marketplace a contului nu expune lucrări ale altor clienți |
| Cont fără acces | Nu primește lucrarea alocată sau adresa privată prin `/api/collaboration` ori `/api/jobs` |
| Admin | Probe operaționale reutilizate: autentificare parolă + TOTP pentru Operator/Manager/Financiar/Super Admin, permisiuni API nominale, foto, scor de observare, SLA și calificare prospectivă cu conflicte de versiune |
| Pro | Probe operaționale reutilizate: Viewer limitat pe proprietate, Owner fără marja internă, redacții pe roluri, dashboard/CSV și recurență zilnică prin UI |

Baseline suplimentar: **34/34 verificări funcționale**, 16 pagini, zero `pageErrors`. Acesta a identificat defectele de accesibilitate și responsive de mai jos; nu este un rezultat WCAG verde. Raportul separă explicit `functionalPassed`, `layoutPassed` și `accessibilityPassed`; `passed` general cere toate cele trei.

## Securitate și compatibilitate cu API mobil

Loginul sintetic verifică cookie `HttpOnly`, `Secure`, `SameSite=Lax`, plus paritatea identității între cookie și token Bearer când `NITIDO_ENABLE_BEARER_AUTH=true`. Logoutul invalidează sesiunea cookie. Cererile cookie de modificare a checklistului dintr-o origine străină sunt respinse cu 403 pentru toate cele patru conturi. Nu sunt expuse tokenuri, parole sau secrete în raport.

Suitele existente reutilizate includ autentificare administrativă/MFA (24), `securityOrigin` (10), `securityRoutes` (6), autorizare (5), securitate foto (5), acces colaborare (22), redirecționări auth (8 în baseline) și eligibilitate oportunități (10). Ele acoperă invarianta serverului; testele browser nu substituie un audit de penetrare complet.

Modelul angajatului este apartenența la echipă, nu un rol nou în tabelul `users`. Aplicația mobilă folosește aceleași sesiuni și API; shellul Expo existent nu constituie un workspace Pro. Auditul backend/mobil a identificat lipsa regulilor foto snapshot în `GET /api/jobs/[id]`; agentul backend a adăugat `photoRules` și `executionRules` numai pentru detaliul autorizat și a limitat dovezile la firma alocată curentă. Firma nu mai primește sume brute private prin contextul AI. Validarea țintită raportată este 30/30 în cinci suite; include șase teste contract pe SQLite real și două teste de context AI. Modificările necesită și validarea candidatului final, nu moștenesc acceptanța baseline.

Actualizarea de securitate Next.js 16.3.5→16.3.8 și sharp 0.35.4→0.35.5 este gestionată de root. Buildul și browserul baseline de mai sus au fost produse înaintea ei; buildul final și regresia aferentă sunt probe separate.

## Candidatul verificat după corecții

Candidatul este arborele de lucru cu modificări peste `19047e8`, înainte de commit; câmpul `sourceSha` al probei browser identifică părintele Git, nu pretinde că fișierele neschimbate reprezintă întregul candidat.

| Verificare postbaseline | Stare confirmată |
|---|---|
| Web Vitest UTC / Europe/Bucharest | 1768/1768 în fiecare fus, 165 fișiere; 0 eșecuri/pending, ambele JSON verificate |
| Node scripts | Root raportează 44/44 trecute |
| Next.js 16.3.8 webpack / TypeScript | Build final trecut, 151 pagini, `BUILD_ID=zSoa4IIt7w7UsPV5Nn4F1` |
| Browser operațional actualizat | 31/31 scenarii, 108/108 layouturi, zero `pageErrors`, buildul `X1e5KWtaYe5r-9LMIl8aU`, anterior ultimei reguli CSS locale VisitCare |
| Browser general și formular ștergere | **39/39 funcționale, 21 pagini, 63/63 layouturi, axe zero încălcări și zero `pageErrors`** pe buildul final `zSoa4IIt7w7UsPV5Nn4F1` |
| Lint / verificări țintite pentru modificările acestui audit | ESLint trei componente trecut fără warnings; 29/29 siteIndexing/siteContent/authRedirect; `node --check` și `git diff --check` trecute |

Buildul intermediar `X1e5KWtaYe5r-9LMIl8aU` avea două depășiri ale inputului foto la 360 px și nu a fost declarat verde integral. După corecția limitată la `VisitCare` și rebuild, raportul final confirmă **`functionalPassed=true`, `layoutPassed=true`, `accessibilityPassed=true`, `passed=true`**. CSS-ul din surse nu a fost injectat în această acceptanță finală. Canonicalul și imaginile Open Graph/Twitter ale celor trei pagini Pro au fost verificate și în HTML-ul noului build.

Cele două regresii locale de 1768 teste au folosit Vitest 4.1.10. Actualizarea instrumentelor de dezvoltare la 4.1.11, efectuată ulterior de root, trebuie verificată separat în CI; rezultatul local nu este atribuit versiunii noi.

Au fost păstrate în raport răspunsurile așteptate 401 ale API-urilor private în sesiunea anonimă și 502 pentru `/api/payments/card` fără credențiale Stripe în serverul sintetic. Zero `pageErrors` înseamnă zero excepții JavaScript necontrolate; nu înseamnă că integrările externe au fost validate.

Agentul mobil raportează separat Expo 143/143 în UTC/București, typecheck/lint, export iOS/Android/web și browser simulat 7/7 cu 18 layouturi. Acestea confirmă contractele surselor Expo, nu buildurile native semnate sau instalarea pe dispozitive; pipeline-ul de distribuție Capacitor ales de root are verificări proprii.

## Defecte web identificate și corecții

- Cele trei linkuri-imagine ale serviciilor de pe homepage nu aveau nume accesibil. Primesc `aria-label` din titlul existent al serviciului, fără text vizibil nou.
- Calendarul săptămânal avea scroll orizontal fără focus de tastatură. Containerul primește `tabIndex=0`, rol `region` și nume accesibil.
- Panoul firmei depășea viewportul la 768 px: elementele grid și graficul păstrau lățimea minimă a conținutului. Corecția permite micșorarea celulelor și împachetarea textului; bara de căutare rămâne în container.
- Câmpul nativ de fotografie a problemei din `VisitCare` păstra o lățime intrinsecă de 344 px și depășea containerul pe firmă/angajat la 360 px. Regula este limitată la acest panou și permite câmpului să ocupe cel mult lățimea disponibilă; nu este o excludere a detectorului pentru inputuri ascunse.
- Petele decorative din pagina de autentificare sunt marcate `aria-hidden`; detectorul continuă să controleze conținutul vizibil și separă elementele ascunse pentru tehnologii asistive.
- Axe a identificat text alb de 14–16 px pe verde `#009E60` cu contrast 3,46:1, sub pragul 4,5:1, și texte secundare prea deschise. Corecția folosește cerneala existentă `#111827` pe verde și verdele închis existent pe fundaluri deschise. Textul pe hover rămâne alb pe verde închis. Backgroundul verde Pro, conturul auriu, crema, geometria, navigația și conținutul comercial sunt păstrate.

Fișierele corecțiilor sunt `src/app/page.tsx`, `src/components/TeamSchedule.tsx`, `src/components/AuthLayout.tsx` și `src/app/workspace-theme.css`. Verificarea CSS injectată pe buildul baseline este doar o previzualizare diagnostică; acceptanța finală trebuie făcută pe buildul care conține și schimbările markup.

## SEO și limitele acceptanței

Sitemap-ul include numai URL-uri publice canonice și localități existente. `/parteneri-pro` rămâne redirect și nu apare ca destinație canonică. Flagul `NEXT_PUBLIC_NITIDO_PRO_PUBLIC` este build-time: schimbarea disponibilității cere rebuild cu aceeași valoare pentru UI și sitemap. Metadata Pro declară explicit imaginea socială și canonicalul propriu; PNG-ul funcționează fără fonturi descărcate din rețea. Sandboxul și suprafețele private sunt `noindex`.

Noua pagină publică de solicitare a ștergerii contului poate fi accesibilă din exterior și `noindex`; nu este necesară indexarea ei în sitemap pentru URL-ul cerut de Google Play. Agentul responsabil a raportat 25/25 teste în UTC și Europe/Bucharest, lint și TypeScript trecute. Harnessul final adaugă solicitarea prin UI pentru client și firmă, respingerea originii străine, replay fără duplicare, no-store și păstrarea datelor contului. Existența unui formular de solicitare nu dovedește executarea ștergerii datelor sau configurarea politicilor reale.

Auditul axe automat nu certifică integral WCAG: lectura cu VoiceOver/TalkBack/NVDA, navigarea manuală completă de tastatură, zoom, contraste în toate stările și conținuturile dinamice rămân probe distincte. Rețeaua externă blocată împiedică validarea hărților și integrărilor externe, emailurilor, pushului, Stripe/3DS/captură/rambursare, iCal real și disponibilității infrastructurii.

Nu au fost verificate instalarea pe iOS/Android real, semnarea distribuției, review App Store/Google Play, credențialele magazinelor sau accesul reviewerului în backend LIVE. Acest audit web nu declară aplicația gata de publicare.

## Reproducere și candidat final

```bash
NITIDO_QA_BUILD_PATH=/cale/catre/build/.next node scripts/qa-general-web.mjs
```

Uneltele QA așteptate: Chromium și `playwright-core`/`axe-core` într-un director separat, configurabil prin `NITIDO_QA_TOOLS`; scriptul nu le adaugă în aplicație. Pentru diagnostic CSS se poate folosi `NITIDO_QA_PREVIEW_CSS=true`, care marchează explicit raportul ca preview.

Dovezi finale: `/workspace/nitido-general-web-final-results/report.json`, cele 21 de imagini în același director și `/tmp/nitido-qa/general-web-final-browser.log`. Dovezi de diagnostic: `/workspace/nitido-general-web-results/report.json`, `/workspace/nitido-general-web-css-preview/report.json` și `/tmp/nitido-qa/general-web-targeted-tests.json`. Rebuildul final, browserul și regresia pentru modificările backend/Next.js/sharp au trecut; validarea uneltelor Vitest 4.1.11 în CI rămâne o probă separată. Integrarea în `main`, deploymentul și publicarea în magazine sunt stări distincte, neexecutate prin acest audit.
