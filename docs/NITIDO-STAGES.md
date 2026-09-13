# NITIDO — situația celor 6 etape din brief

Sursa numerotării: `NITIDO-MASTER-SOURCE.md`, §18. Documentul urmărește execuția și acceptarea separat. Nu reprezintă acceptarea beneficiarului.

| Etapă | Starea execuției | Condiție rămasă pentru închidere |
|---|---|---|
| E0 — Audit P0 | Audit tehnic și probleme documentate în mai multe continuări | Consolidarea matricei integrale existent/parțial/lipsă/defect și a dependențelor; închiderea formală nu este consemnată |
| E1 — Design P1 | Redesign web/mobil implementat parțial față de întregul brief | Toate stările și ecranele principale demonstrate și acceptate vizual |
| **E2 — Nucleu P0/P1** | **Etapa activă: fluxuri, acces, plăți, notificări și admin; recuperare periodică sandbox adăugată** | Fluxuri complete pe staging, provocări Stripe, QA autentificat și probe de integritate/concurență; restul cerințelor nucleului |
| E3 — Recurență P2 | Proprietăți, serii și calendar implementate parțial | Completare și acceptare a politicii financiare pe vizită, anulărilor, preferințelor și capacității |
| E4 — Business P3 | Locații, aprobări, rapoarte și Host implementate parțial | Funcții organizaționale/integrări rămase și pilot cu izolare și sincronizare validate |
| E5 — Lansare | Proceduri, gate și instrumente de pregătire existente | Migrare/restaurare pe țintă, verificări operaționale, acceptare finală și aprobare explicită de publicare |

După E2 urmează 3 etape principale: E3, E4 și E5. Rămân de închis și restanțele E0/E1. Dezvoltarea unor componente din E3/E4 nu echivalează cu acceptarea acelor etape.

## Livrarea curentă în E2

- Recuperare periodică pentru inboxul Stripe restant și anulările deja solicitate, strict în sandbox.
- Rezervare de execuție persistentă, protecție după restart, retry cu pauze, limită de încercări și istoric în admin.
- Același procesor pentru webhook și recuperare, cu deduplicare și protecția stărilor concurente păstrate.
- Runner inclus în imaginea standalone; activarea și programarea pe infrastructura țintă nu sunt efectuate.

Operare și limite: [NITIDO-FINANCIAL-RECOVERY.md](NITIDO-FINANCIAL-RECOVERY.md).
Condițiile externe încă deschise: [NITIDO-RELEASE-GATE.md](NITIDO-RELEASE-GATE.md).
SHA-ul candidatului și CI-ul aferent sunt consemnate în PR #49; rezultatele etapelor anterioare nu se atribuie automat candidatului nou.

Nu se raportează un procent de finalizare din numărul testelor. E2 rămâne deschisă până la probele cerute de brief.
