# A2 — Oferta acceptată către rezervare compatibilă

Continuă PR59. Pregătit pentru sandbox, implicit dezactivat; fără deploy sau modificare Stripe.

## Comportament

Clientul acceptă mai întâi oferta, apoi confirmă separat crearea rezervării la totalul afișat. Formularul cere adresa, codul poștal, etajul și tipul proprietății. Serverul verifică proprietarul, starea acceptată, versiunea cererii, decizia internă de marjă și compatibilitatea financiară.

Rezervarea este creată prin API-ul existent /api/jobs. Totalul și descrierea serviciului provin din oferta înghețată, nu din formular sau din tariful automat actual. Snapshot-ul lucrării păstrează oferta și revizia. Creditul din cont nu este aplicat și nici debitat suplimentar.

O ofertă are cel mult o rezervare, cu legătură permanentă și eveniment de audit. Crearea lucrării, snapshot-ul, legătura și evenimentul sunt în aceeași tranzacție. La reîncercare, inclusiv cu alt Idempotency-Key, se întoarce aceeași lucrare. Două oferte distincte nu sunt confundate dacă browserul refolosește aceeași cheie HTTP.

Acceptarea trebuie să fi fost înregistrată înainte de expirare. După acceptare, termenii acceptați rămân valizi pentru acest pas, atât timp cât cererea nu s-a schimbat; termenul de acceptare nu este reinterpretat ca termen de executare. O rezervare deja creată se recuperează și după schimbarea stării cererii.

## Compatibilitate financiară, fără modificare Stripe

Integrarea actuală calculează remunerația firmei prin calcNetForFirm și tratează credit_applied ca pe credit al clientului. Prin urmare:

- Costul prestatorului trebuie să fie confirmat și identic cu remunerația calculată de regula actuală.
- Reducerea manuală trebuie să fie zero. O reducere comercială nu este convertită artificial în credit, care ar putea fi restituit ulterior în portofel.
- Suma în bani trebuie să poată fi reprezentată exact de traseul monetar existent; cazurile incompatibile sunt blocate, nu rotunjite tacit.
- Regula de autorizare/captură existentă rămâne aceeași. Crearea rezervării nu execută singură plata; autorizarea are loc la preluarea de către firmă.

Nu sunt modificate contul, cheile, webhook-urile, authorizePayment, calculatePaymentSplit sau mecanismul Stripe existent. Nu au fost efectuate plăți externe în această etapă.

## Domeniu acoperit

Numai întreținere și curățenie generală, dificultate redusă/normală, până la limitele existente de suprafață și geamuri; fără aparate, lenjerie sau ore suplimentare. Descrierea publică trebuie să încapă integral în detaliile lucrării (maximum 500 caractere). Nu se trunchiază serviciile acceptate.

Se folosește modul existent de preluare directă, următorul interval disponibil, fără garanția Express 60. Nu se combină cu ofertele de tarif automat, licitarea Standard, lucrări recurente, aprobări sau proprietăți Pro. Cazurile neacoperite primesc mesaj explicit de programare asistată.

Aceasta nu închide toate cerințele ofertării manuale din brief. Sunt încă necesare: programări negociate, suprafețe mari/cazuri complexe, renovare cu fotografii verificate, reduceri comerciale reconciliate și remunerații diferite de regula actuală.

## Activare și rollback

Sunt necesare simultan flagul existent NITIDO_MANUAL_OFFERS_SANDBOX=true și NITIDO_MANUAL_OFFER_BOOKING_SANDBOX=true, domeniul sandbox exact și absența unei chei Stripe live sk_live_/rk_live_. Nicio variabilă nu este schimbată de acest pachet.

Tabela assessment_offer_jobs este adăugată fără modificarea datelor existente. Cheile externe leagă oferta, lucrarea și clientul; cheile unice împiedică duplicarea, iar trigger-ele protejează istoricul. Dezactivarea flagului nou oprește rezervările noi din oferte. La rollback păstrează tabela și istoricul, nu șterge comenzile sau referințele financiare.

## Verificări și limite

438 teste în 34 fișiere, UTC și Europe/Bucharest; Next typegen, TypeScript și ESLint țintit. Testele trec prin API-ul real de rezervare și SQLite, verifică totalul prin formula de plată existentă, ownership, context, incompatibilități, confirmare explicită, reîncercări, rollback și păstrarea creditului.

Verificarea vizuală desktop/mobil și E2E în sandbox rămâne blocată de politica de acces a browserului. Nu se declară un test real de card, 3DS, autorizare sau captură pentru această ofertă. PR59 avea CI verde înainte de această etapă.
