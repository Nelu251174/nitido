# NITIDO — QA pentru completarea operațională

Data: 9 octombrie 2026. Referință normativă: `MASTER-BRIEF-v1.1.md`, inclusiv amendamentele A–H.

Pachetul continuă implementarea PR #86 (`97938ad`). Ramura verificată este `codex/nitido-operational-completion`, cu reconcilierea istoricului `main` în commitul `dd74c22`; sursele și probele noi sunt grupate în această ramură. Reconcilierea în ramura de lucru nu reprezintă integrarea ramurii în `main`.

## Starea livrării

| Dimensiune | Stare confirmată |
|---|---|
| Implementare | Calificare operațională a evaluărilor, SLA și alerte interne pentru incidente, dashboard consolidat Pro, corecții SEO și imagine socială implementate în repository |
| Testare locală | Regresia completă web în două fusuri orare, testele scripturilor și verificările aplicației mobile existente trec |
| Integrare în `main` | Nu; `origin/main` rămâne la `2101988542d989b46cb2c091922d16ddce334387` |
| Publicare LIVE | Nu; accesul Coolify/host nu este configurat și domeniile sunt blocate înainte de autentificare |

Funcțiile deja validate în PR #86 sunt păstrate. Pachetul nu reconstruiește aplicația mobilă și nu schimbă infrastructura, configurarea ori fluxurile Stripe.

## Rezultate reproductibile

Agenții au confirmat stabilizarea surselor și testelor înaintea regresiei integrale. Nu au fost eliminate sau omise teste pentru obținerea unui rezultat verde.

| Verificare | Rezultat |
|---|---|
| Vitest web, `TZ=UTC` | **1743/1743**, 160 fișiere; 0 eșecuri, 0 pending/skipped |
| Vitest web, `TZ=Europe/Bucharest` | **1743/1743**, 160 fișiere; 0 eșecuri, 0 pending/skipped |
| Scripturi Node, izolarea implicită `node --test` | **44/44**; 0 eșecuri, 0 cancelled/skipped/todo |
| Aplicația mobilă existentă, Vitest, `TZ=UTC` | **122/122**, 13 fișiere; 0 eșecuri, 0 pending/skipped |
| TypeScript mobil, `tsc --noEmit` | Trecut, exit 0 |
| ESLint pentru cele 39 de fișiere TypeScript modificate/noi | Trecut, exit 0 cu `--max-warnings 0` |
| `git diff --check` | Trecut |

După regresia completă, verificarea HTTP a identificat lipsa `og:image` și `twitter:image` pe cele trei pagini publice Pro: obiectele metadata ale paginilor înlocuiau metadata socială moștenită. Helperul public declară acum explicit imaginea comună `/opengraph-image`. Cele 11 teste țintite SEO și PNG trec, iar ESLint pentru cele două fișiere trece; rebuildul și verificarea HTTP a acestei corecții finale au trecut.

Baseline-ul anterior PR #86 avea 1661 de teste verzi în 151 de fișiere. Pachetul adaugă **82 de teste în 10 fișiere**, fără reducerea numărului de teste din fișierele existente.

Comenzi:

```bash
TZ=UTC npm run test:upgrade:consolidated
TZ=Europe/Bucharest npm run test:upgrade:consolidated
node --test scripts/*.test.mjs
cd mobile
TZ=UTC npm test
npm run typecheck
```

Testele Node au folosit izolarea implicită, conform CI. Permisiunea de rețea acordată runnerului permite inclusiv serverele locale necesare fixturelor; testele de restaurare nu contactează servicii și nu modifică baza sursă. Nu au fost create rezervări sau plăți reale pentru validare.

## SEO, navigație și imagine socială

Sitemap-ul include numai paginile publice canonice și localitățile existente în cod. Intrarea Pro urmează flagul public: paginile dezactivate nu sunt anunțate ca URL-uri indexabile. Redirectul existent `/parteneri-pro` rămâne funcțional, iar sitemap-ul indică destinația `/nitido-pro/parteneri`.

`NEXT_PUBLIC_NITIDO_PRO_PUBLIC` este configurat la build, prin Docker ARG, și trebuie să aibă aceeași valoare pentru UI și sitemap. Schimbarea disponibilității publice Pro necesită rebuild; modificarea izolată a variabilei runtime nu înlocuiește valoarea compilată în aplicație.

Cele trei pagini Pro au canonical, titlu, descriere și metadate sociale proprii, cu imaginea comună declarată explicit în Open Graph și Twitter. Originul configurat este folosit coerent, inclusiv varianta `www`; URL-ul sitemapului din robots nu dublează slashurile. `/pro` este exclus din robots, iar sandboxul și rutele private păstrează headerul `X-Robots-Tag` cu `noindex`.

Intenția imaginii sociale existente anterior în `main` este recuperată: PNG **1200×630**, sub limita de 5 MB, cu brandul crem/verde și text existent în homepage. Imaginea a fost decodată și inspectată vizual; fonturile Inter Latin și Latin Extended sunt locale, iar testul reușește cu solicitările HTTP dezactivate. Diacriticele românești sunt corecte.

Bara crem, intrarea Pro verde cu contur auriu, navigația aprobată, CSS-ul și textele vizibile ale paginilor sunt păstrate. Modificările de text sunt limitate la metadata: corectarea unei greșeli de ortografie și eliminarea mențiunii telefonice care nu mai corespundea contactului existent.

## Verificări care necesită probe separate

| Verificare | Stare la redactare |
|---|---|
| Build Next.js de producție și TypeScript web | Buildul final a trecut, exit 0, TypeScript și 148 de pagini; BUILD_ID `OqRZN5ykbLZwD0UQ0Rxqn` |
| Randare HTTP în output standalone | 8/8 probe HTTP pentru Pro public activ și 5/5 pentru un build separat cu Pro public dezactivat; canonical/OG/Twitter, PNG 1200×630, robots/sitemap și sandbox noindex confirmate. Ambele WOFF sunt în standalone |
| Parcurgere browser desktop/mobil și pe roluri | 31/31 scenarii, 108/108 layouturi la 360/390/430/768/1024/1440 px, zero erori JavaScript; sesiuni MFA reale pe server local și date sintetice. BUILD_ID `OqRZN5ykbLZwD0UQ0Rxqn` |
| Imagine Docker finală și runtime | Trecut pe imaginea `sha256:9e9aac72b38731c8c9db8a5473506a0cfbba99b6829842ecf50d9abaf794a74c`: build Turbopack, 148 pagini, UID1001/Node22, SQLite nativ, fonturi/helpers/schema și HTTP PNG 1200×630. Simulatorul în aceeași imagine trece fără rețea |
| Backup/restaurare și plan de revenire pentru mediul țintă | 44 de teste Node includ drillurile locale; simulatorul în imaginea finală păstrează cele trei rădăcini și datele noi. Backupul efectiv LIVE rămâne neexecutat |
| Deployment sandbox/LIVE și sănătate după publicare | Neconfirmate în această notă |
| iOS/Android pe dispozitive, TestFlight/Google Play | Neconfirmate; verificările surselor mobile nu reprezintă distribuție sau instalare pe dispozitiv |

Prima verificare a outputului standalone a identificat lipsa fișierelor `inter-latin-700-normal.woff` și `inter-latin-ext-700-normal.woff`, deși randarea din surse trecea. Root a adăugat cele două fișiere în `outputFileTracingIncludes` pentru ruta imaginii sociale, conform ghidului Next.js instalat. Rebuildul a trecut, iar ambele fișiere sunt prezente în standalone. Acceptarea HTTP standalone a trecut; proba imaginii Docker finale a trecut, conform raportului de mai sus.

Buildul Docker pornit cu o bază goală a expus o cursă reală între cele patru procese Next: verificarea tabelului gol și inserarea celor patru opțiuni implicite ale estimatorului nu erau atomice, generând `UNIQUE constraint failed: estimator_options.key`. Root a mutat verificarea și inserările într-o tranzacție `IMMEDIATE`, cu blocarea dobândită înainte de `COUNT`. Două teste noi probează rollbackul integral dacă o inserare eșuează și păstrarea unei liste parțiale configurate de administrator. Regresia completă a fost rerulată după acest fix și trece cu **1743/1743** în fiecare fus orar; buildul final trece. Pornirea Docker cu o bază proaspătă rămâne verificarea runtime distinctă.

Root a verificat și stagingul WAL din drillul de recovery; după corecție, testele Node au fost rerulate cu izolarea implicită și trec **44/44**. Dovezile Node au fost actualizate în același log.

Aceste stări se actualizează numai după primirea probelor aferente.

## Dovezi locale

Artefactele QA sunt în `/tmp/nitido-qa/`:

- `operational-final-utc.json` și `.log`
- `operational-final-bucharest.json` și `.log`
- `operational-test-matrix.md`
- `operational-node-tests.log`
- `operational-mobile-tests.json` și `.log`
- `operational-mobile-typecheck.log`
- `operational-social-metadata-tests.json` și `.log`
- `public-seo-audit.md`
- `og-image-test.json`, `og-image-test.log` și `nitido-og.png`

Fișierele din `/tmp` sunt artefacte locale ale sesiunii; comenzile de mai sus reproduc verificările din repository.

## Acceptanță responsive și migrare packaged

Detectorul browser verifică main și descendenții, inclusiv depășirile ascunse prin overflow global; permite numai scrollere locale care rămân în viewport. Corecțiile administrative au păstrat paleta, navigația și componentele existente: lățime explicită pentru wrapper, elemente de grid care se pot micșora și scroll local al tabelului. Toate cele 108 verificări finale trec.

Probele de migrare folosesc scripturile reale compilate `pro-build-migration.mjs` și `pro-migrate.mjs`: reviziile 13–14 și rerularea idempotentă păstrează 27 de tabele, istoricul și datele daily. Aceste probe sunt izolate, fără modificarea bazei reale.

Dovezi browser: `docs/upgrade/qa/operational-browser-report.json`, imagini locale în `/workspace/nitido-qa-operational-results/`. Dovezi public HTTP și migrare: `/workspace/nitido-qa-public-http-results/`.

Dovezi Docker locale: `/workspace/nitido-docker-release-verified-evidence-20261009/`. Cele 9 teste ale helperelor trec atât pe Node24 local, cât și pe Node22 din Docker. Nu s-au montat volume reale sau folosit credențiale de servicii. Curățarea pentru recuperarea spațiului a eliminat numai cache npm/build și imagini temporare QA; imaginea verificată, codul și rapoartele sunt păstrate.
