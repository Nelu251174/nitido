# QA consolidat — 25.09.2026

## Probe locale

| Verificare | Rezultat |
|---|---|
| `TZ=UTC npm run test:upgrade:consolidated` | 711 teste trecute, 56 fișiere |
| `TZ=Europe/Bucharest npm run test:upgrade:consolidated` | 711 teste trecute, 56 fișiere |
| `npm run test:backup` | 5 teste trecute |
| `next typegen` + `tsc --noEmit` | Trecute |
| `npm run build -- --webpack` | Build complet trecut, inclusiv generarea rutelor |
| `git diff --check` | Trecut |

Acestea sunt probe ale candidatului local. Selecția consolidată include A0–A4 și noile module; **nu este întreaga suită a repository-ului**. Rezultatele nu confirmă CI pe un SHA remote până când acel workflow nu se termină. Nu au fost făcute rezervări sau plăți reale.

Buildul a identificat o dependență circulară introdusă prin încărcarea serviciului CRM din inițializarea bazei. Schema nouă a fost mutată în `operationsSchema.ts`, un modul fără importuri de servicii. Buildul complet a fost repetat după remediere. În workspace se folosește explicit Webpack pentru instalarea existentă de dependențe; workflow-ul GitHub folosește instalare curată și comanda normală de build.

## Extensie CRM/checklisturi

Candidatul curent este `feat/nitido-crm-checklist-controls`. Testele suplimentare verifică refuzul rezervării fără consum de credit, replay-ul, ofertele asistate, restricția independentă a evaluărilor, izolarea recurențelor, păstrarea cursorului, auditul atomic, reviziile de checklist, sarcinile nerealizabile, raportul și finalizarea. Agregatele CRM sunt verificate dincolo de pagina de istoric, cu ultima revizie de cost, necunoscute și pierderi confirmate. Suita include acum și regresia garanției, deoarece revenirea moștenește lista originală.

Testul de integrare a conturilor folosește acum o bază nouă la fiecare caz, păstrând trigger-ele de imutabilitate; vechiul cleanup prin DELETE nu mai era compatibil cu rapoartele arhivate. Sunt verificate și izolarea listei între clienți, accesul echipei și revocarea la realocare.

Scenariile reale de sandbox sunt în `CRM-AND-EXECUTION-CONTROLS.md`. CI pentru PR #82 este doar proba părintelui; candidatul nou necesită rezultatul propriului SHA.

## Ce riscuri acoperă testele noi

- Raport: zile de 23/25 ore în România, limite de perioadă, filtre parametrizate, stări curente, recenzii publicate asociate corect, dovezi de la firma alocată, reclamații confirmate versus neconfirmate, corecții de concluzie și deduplicare pe lucrare.
- Marjă: ultima revizie, discount aplicat o singură dată, estimări separate, imposibilitatea de a raporta total confirmat când lipsesc costuri.
- Prestatori: indicatori observați fără modificarea datelor firmei sau alocării; date insuficiente afișate explicit, fără scor inventat.
- Triage: termene neconfigurate, ancore temporale, politici versionate, reatribuire fără reset de termene, răspuns al prestatorului verificat, lipsa notelor interne din vizualizarea clientului/firmei, editări concurente și istoric imuabil.
- CRM: izolare pe client, lipsa secretelor din răspuns, wildcard tratat ca text, paginare, note și clasificări cu istoric și fără efecte automate pe comenzi.
- API: Admin verificat, origine, corp invalid/supradimensionat, actor neacceptat din request, audit atomic cu rollback și erori fără detalii SQL.
- Inițializare aditivă repetată și chei externe păstrate.
- Backup: WAL confirmat, restaurare separată, relații și triggere păstrate, lipsă sursă, destinație existentă, corupție și FK invalide.

## Reproducere

```sh
npm ci
TZ=UTC NITIDO_SEED_DEMO=false npm run test:upgrade:consolidated
TZ=Europe/Bucharest NITIDO_SEED_DEMO=false npm run test:upgrade:consolidated
npm run test:backup
npx next typegen
npx tsc --noEmit
NITIDO_SEED_DEMO=false npm run build
```

Folosește o copie de lucru izolată și date de test. Scriptul de verificare al bazei reale se execută separat, conform `BACKUP-RESTORE.md`, nu ca înlocuitor al testelor unitare.

## Acceptanță operațională încă deschisă

| Scenariu pe candidatul publicat în sandbox | Dovadă necesară |
|---|---|
| Standard: ofertă → selecție → alocare → dovezi → finalizare | Conturi test distincte, ID-uri, capturi, preț/snapshot păstrate |
| Express: două acceptări concurente, capacitate indisponibilă, expirare | Un singur câștigător și lipsa expunerii private către cel nealocat |
| Ofertă asistată: revizie expirată, confirmare, echipă, retry | Reconfirmare explicită, aceeași rezervare, capacitate rezervată atomic |
| Pro: organizații separate, proprietăți limitate, recurență, aprobări/rework și CSV | Fără acces între organizații; costuri și coloane autorizate; lipsă duplicate |
| Admin: raport fără costuri complete, note interne CRM/incident, două editări simultane | Valori necunoscute explicite, 409 pe revizie expirată, note absente la Client/Firma |
| Aspect crem și navigație, desktop și 360/390/430 px | Capturi reale; fără scroll orizontal nedorit, text tăiat sau suprapunere alb/verde |
| iOS/Android fizic: login, tastatură, safe area, upload și notificări | Model, OS, versiune/build, probe succes/eroare și disponibilitate în distribuție |
| SQLite + fotografii + revenire la imagine compatibilă | Restaurare pe infrastructura țintă, hashuri, totaluri, acces foto și durată |

Niciun rând din acest ultim tabel nu este marcat PASS pe baza testelor locale. Configurația conturilor și infrastructurii reale, pilotul și deciziile comerciale rămân separate de validarea codului.
