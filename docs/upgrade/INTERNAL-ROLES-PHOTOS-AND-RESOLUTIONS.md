# Roluri interne, reguli foto, dashboard și rezoluții

Data: 25.09.2026. Candidat: `feat/nitido-internal-operations`, continuă PR #84 / `66ab20494b54f11a547207e70063afd4dace5429`.
Acest document descrie codul candidat. Nu confirmă publicarea în sandbox sau producție.

## Conturi interne nominale

| Rol | Acțiuni permise în noul spațiu de lucru |
|---|---|
| Operator NITIDO | Evaluări, planificare și rezervare asistată; dovezi; verificarea și preluarea incidentelor; propuneri de rezoluție |
| Manager operațional | Drepturile Operatorului; catalog, capacitate, prețuri și checklisturi; dashboard; finalizarea rezoluțiilor operaționale |
| Financiar | Dashboard, costuri documentate, reconciliere, rambursare prin fluxul existent; citirea incidentelor și rezoluții financiare |
| Super Admin | Toate drepturile de mai sus; gestionarea rolurilor și accesul la suprafețele administrative istorice |

Autorizarea este pe server. `isAdmin()` fără permisiune explicită rămâne Super Admin, astfel încât o rută veche neclasificată nu devine accesibilă tuturor. Rolurile organizaționale Pro rămân separate. CRM-ul administrativ istoric și administrarea globală Pro rămân Super Admin; delegarea lor granulară este încă deschisă.

Contul principal existent păstrează MFA. Super Admin înregistrează adresa, rolul, starea și motivul în secțiunea Conturi interne. Credentialele nominale se configurează separat, prin variabila securizată `NITIDO_ADMIN_STAFF_ACCOUNTS_JSON`, un array de obiecte cu `email`, `passwordHash`, `totpSecret` și opțional `recoveryHashes`. Hashurile bcrypt trebuie să aibă cost 10–16; nu se acceptă parole în clar pentru conturile noi. Secretele MFA trebuie să fie distincte inclusiv față de contul principal. Configurația invalidă blochează autentificarea conturilor nominale; nu relaxează MFA.

Nu se salvează secrete în DB, istoric, răspunsuri HTTP sau în repository. Un cont activ fără credențiale configurate nu poate intra. Schimbarea rolului/stării crește revizia, este auditată și revocă sesiunile existente. Identitatea folosită în operațiile noi este nominală și stabilă. Propriul rol și contul principal nu se modifică din aceeași sesiune.

## Reguli foto și compatibilitate

Marketplace: editorul checklisturilor publică numărul minim de fotografii validate la sosire și finalizare, pe serviciu. Minimele sunt copiate imuabil în lucrare; o modificare nu rescrie lucrările existente. Lucrările istorice păstrează minimum o fotografie la fiecare etapă. Sunt numărate doar dovezile validate ale firmei alocate. Raportul, finalizarea și verificarea dovezilor din fluxul de plată folosesc aceleași cerințe.

Pro: migrarea aditivă **13** adaugă politica foto pe proprietate/serviciu și copia pe lucrare. Se permit 0–19 fotografii înainte și 1–20 la finalizare, maximum 20 obligatorii cumulat. Lucrările existente rămân la cerința istorică 0 înainte / 1 la finalizare. Recurențele folosesc politica de la crearea fiecărei lucrări. Istoricul versiunilor afișează și minimele foto.

Prestatorul Pro alocat poate încărca dovezi «Înainte» în stările accepted/rework_requested; celelalte categorii cer execuție activă. Pornirea verifică minimele de sosire. Predarea verifică fotografii distincte după execuție/remediere. Rework cere fotografii ulterioare solicitării de remediere și păstrează istoricul anterior; plafonul de 20 se aplică fiecărei execuții, nu cumulat întregii istorii. Accesul la fișiere rămâne privat, prin regulile existente de scope și alocare.

Migrarea Pro se execută explicit după backup verificat, în containerul mediului țintă:

```sh
NITIDO_PRO_DB_PATH=/app/data/nitido.db node /app/scripts/pro-migrate.mjs
```

Schema Marketplace/conturi/rezoluții este aditivă la inițializare. Codul nu golește tabele și nu migrează automat o schemă Pro legacy incompatibilă. Fără migrarea 13, Pro păstrează regulile istorice și ascunde editorul foto. Nu se șterg tabelele noi la rollback; o revenire la codul vechi nu ar mai aplica minimele foto noi și cere oprirea controlată a fluxurilor afectate.

## Dashboard

Filtre: perioadă, oraș, **zonă prin cod poștal exact**, serviciu din snapshot, mod Standard/Express, spațiu, client și prestator. Lucrările vechi fără serviciu salvat sunt etichetate separat. Maximum 10.000 lucrări/cereri; depășirea cere restrângerea selecției, fără trunchiere ascunsă.

Indicatori adăugați: mediană până la alocare și prima ofertă, eșantioane; anulări, no-show, reclamații confirmate, remedieri și comenzi repetate; rating publicat; valoare medie; valoarea serviciilor din istoricul clienților selectați; marjă documentată în sumă și procent. Marja totală rămâne necunoscută dacă lipsesc costuri. Valoarea serviciilor nu este prezentată ca încasare, venit contabil sau profit.

Cererile asistate au cohortă proprie după data creării și conversie prin rezervarea asociată. Filtrele pe care o cerere neconvertită nu le poate avea fac indicatorul indisponibil, nu 100%. Acceptarea prestatorilor rămâne indisponibilă: lipsește registrul complet al invitațiilor. Nu se inventează numitorul. Raportul acoperă Marketplace; rapoartele Pro rămân distincte. Scorul de alocare automată nu este activat.

## Rezoluțiile incidentelor

Propunerea și rezoluția finală sunt evenimente distincte, imuabile, cu autor și motiv intern. Orice scriere verifică revizia dosarului și se salvează în aceeași tranzacție cu auditul. Operatorul propune; Managerul închide operațional; Financiarul confirmă financiar.

- Respingere: necesită verificare «problemă neconfirmată».
- Remediere: necesită lucrarea de revenire asociată finalizată.
- Rambursare: folosește endpointul financiar existent, cu confirmare explicită în interfață. Închiderea cere plata și rambursarea confirmate în DB, nu numai cererea Stripe.
- Reverificare prestator: necesită referința verificării.
- Suspendare prestator: necesită o dată viitoare aprobată; nu poate scurta o suspendare existentă.
- Credit/penalizare: numai propuneri până la implementarea și aprobarea politicii comerciale. Nu produc solduri sau sume fictive.

O vizită de remediere încă activă împiedică închiderea. Clientul/prestatorul văd tipul și data rezoluției finalizate, fără notele și referințele interne. Nu se trimit notificări noi automat.

## Verificare și acceptanță

**Rezultate locale pentru acest candidat:** 61 fișiere / 791 teste trecute în UTC și încă o rulare cu 791 teste trecute în Europe/Bucharest; 5 teste backup/restaurare trecute; `next typegen`, `tsc --noEmit` și `next build --webpack` reușite. Nu s-a executat testare manuală pe dispozitive sau pe conturi reale pentru această etapă.

Testele noi verifică matricea de permisiuni, autentificarea nominală cu MFA, revocarea sesiunilor, redacția câmpurilor financiare, originea cererilor, conflictele de revizie, rollback la audit indisponibil, snapshoturi foto, fotografii distincte, upload înainte de pornire, rework, definiții KPI și rezultat financiar confirmat.

Suita integrală a repository-ului a fost comparată cu baza: aceleași **82 teste eșuate și un fișier care nu se poate importa**, în aceleași 10 fișiere. Lista eșecurilor este identică; nu sunt declarate remediate de acest pachet. Problemele includ fixture-uri de alocare/recuperare depășite, așteptări de conținut vechi și dependența push lipsă. Regresia consolidată, typecheck și build sunt raportate separat.

Acceptanța de mediu rămâne de făcut: provisionarea conturilor nominale, migrarea 13, scenarii autentificate Operator/Manager/Financiar/Super Admin, fotografii pe dispozitive reale și confirmarea rambursării în Stripe sandbox. Nu există dovadă nouă de distribuție TestFlight/Google Play sau de publicare LIVE pentru acest pachet.
