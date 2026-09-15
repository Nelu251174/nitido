# E2 — recuperarea confirmării Standard

Baza continuării: `15a3df4c9059d8d12a80ef122412f97e63cb2769`. Cerințe: brief master §08, §13 și §15.

## Ce se recuperează

Autorizarea poate fi salvată cu succes, iar actualizarea ofertelor poate eșua ulterior. Firma rămâne rezervată, dar oferta nu este confirmată local. Versiunea precedentă păstra această stare pentru intervenție manuală.

Noua tabelă `selection_confirmations` păstrează dovada deciziei: tokenul acceptării, lucrarea, oferta, firma, clientul, plata și snapshotul sumelor/identității PaymentIntent. Dovada este inserată în aceeași tranzacție cu salvarea sau revalidarea locală a plății autorizate. Dacă înregistrarea dovezii eșuează, tranzacția locală nu salvează parțial plata nouă. Aceasta nu anulează implicit un rezultat deja produs la Stripe; reconcilierea externă existentă rămâne necesară pentru un asemenea eșec.

Confirmarea normală a ofertelor marchează dovada `confirmed` în aceeași tranzacție. Dacă finalizarea ofertelor eșuează, dovada rămâne `pending` și poate fi folosită după restart.

## Reluare pe web și mobil

Clientul proprietar vede în detaliul lucrării că selecția este în așteptare și poate apăsa **Finalizează confirmarea**. API-ul `POST /api/jobs/[id]/selection-recovery` cere autentificare de client, origine validă și limită de 10 încercări/minut/utilizator. Nu primește de la client token, ofertă aleasă, sumă sau referință financiară; le citește din dovada salvată.

Într-o singură tranzacție de scriere, reluarea verifică:

- același token curent de acceptare, client, firmă și lucrare Standard încă `accepted`;
- aceleași preț și credit salvate;
- exact o plată, cu același ID, aceeași sumă și aceeași referință PaymentIntent, încă `authorized` local;
- lipsa rambursării, disputei și cererii persistente de anulare;
- oferta aleasă încă `pending`, fără o altă ofertă deja acceptată.

Apoi confirmă oferta, respinge celelalte oferte încă în așteptare, confirmă dovada și scrie auditul. Aceste efecte sunt atomice. Retrimiterea după un răspuns pierdut este idempotentă și nu dublează auditul. Un refuz păstrează starea pentru verificare; o eroare de bază/lock este raportată controlat.

## Limite importante

Reluarea **nu apelează Stripe și nu scrie în plăți sau în starea lucrării**. Repară consecvența locală a unei decizii deja autorizate; nu verifică din nou valabilitatea actuală a holdului la procesator. Expirarea sau anularea externă încă nesincronizată rămâne responsabilitatea fluxurilor financiare existente. Nu este capturare, transfer, rambursare sau o nouă autorizare.

Dovezile nu sunt reconstruite pentru selecțiile vechi și nu sunt deduse doar din starea `authorized` a unei plăți. Cazurile fără dovadă, cu token nou, stare schimbată, date neconcordante, anulare/dispută sau fără plata originală rămân pentru reconciliere. Reluarea automată prin scheduler, expirarea rezervărilor și toate cazurile în care commitul autorizării nu a fost salvat rămân deschise. Nu se declară închisă reconcilierea integrală a alocării.

API-ul de detaliu expune doar starea `pending` clientului proprietar; tokenurile, ID-ul intern al plății și istoricul dovezilor nu sunt trimise în această stare de recuperare. Verificările de autentificare/ownership existente rămân aplicabile.

## Migrare și probe

Schema este aditivă, fără backfill sau rescriere de istoric financiar. Păstrați tabela la rollback. Nu combinați instanțe vechi și noi care procesează aceleași alocări; vechiul cod nu creează dovada durabilă. MFA și backupul necesare înainte de instalare rămân aplicabile.

Testele verifică plata nouă și revalidarea uneia existente, rollbackul dovezii, eșecul finalizării, redeschiderea bazei SQLite, idempotenta pe două conexiuni, izolarea clientului, identitatea/sumele, anulări, dispute, tokenuri depășite și rollbackul auditului. Testul de reluare rulează fără configurație Stripe și cu scrierile în plăți blocate prin trigger.

Pe staging rămân de demonstrat butonul și mesajele web/Expo, reluarea după întreruperea procesului, refuzurile și concordanța cu plata din sandbox. Nu s-au făcut în această continuare tranzacții în contul beneficiarului sau QA pe dispozitive fizice.

Aprobarea pentru producție este deja primită. Instalarea nu este efectuată; E2 rămâne activă.
