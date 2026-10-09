# Pregătire operațională a cererilor pentru un plan verificat

Continuare din PR #86 / `97938ad`. Referință: brief v1.1, amendamentele A/E/G și cerințele de audit/QA. Acest pachet instrumentează date prospective; nu definește o politică comercială nouă și nu închide KPI-ul «comenzi confirmate / cereri eligibile».

## Ce este măsurat

Jurnalul se numește **pregătire operațională pentru planul verificat**. Verificarea folosește serviciile existente de planificare/capacitate și dovezi, fără ponderi, praguri, prețuri sau cote fiscale noi:

- Planul există, aparține versiunii curente a cererii și are un început viitor.
- Verificarea capacității refolosește asocierea configurată serviciu–firmă, verificarea firmei, localitatea acoperită, suspendarea, echipele active, durata/deplasarea și conflictele firmei/echipelor.
- La renovare, fotografiile sunt validate și aprobate pentru versiunea curentă a cererii.
- Datele de capacitate necunoscute sau invalide nu sunt considerate disponibile.

Aceste verificări nu certifică documentele prestatorului, marja, prețul, oferta, aprobarea clientului sau eligibilitatea finală la acceptare. Toate verificările de ofertare/alocare/plată existente continuă separat. Nu se rezervă capacitate și nu se creează comenzi sau plăți.

| Stare | Semnificație |
|---|---|
| `pending` | Cerere nouă, plan/dovezi/configurare lipsă, interval expirat sau verificare care nu mai corespunde datelor curente |
| `ready` | Criteriile operaționale existente ale acestui plan erau îndeplinite la verificarea nominală |
| `unavailable` | Există date de capacitate confirmate, însă firmele configurate nu pot acoperi acest plan/interval. Nu reprezintă neeligibilitate comercială definitivă |
| `legacy_unknown` | Cererea nu are marker prospectiv de la creare; istoricul nu este reconstruit din configurația actuală |

## Trasabilitate și actualitate

Schema este aditivă: `assessment_qualification_events`, cu istoric imuabil. Numai crearea unei cereri noi adaugă markerul inițial `pending`, în aceeași tranzacție cu cererea. Replay-ul unei cereri vechi nu fabrică marker; nu există backfill. Autorul inițial este clientul autentificat. Verificările ulterioare cer un operator nominal, motiv, versiunea cererii și revizia jurnalului; sunt atomice cu auditul administrativ.

Snapshotul păstrează planul, capacitatea observată, dovezile și concluzia. La citire, serverul reverifică datele relevante. O schimbare a versiunii, planului, capacității, dovezilor sau a validității intervalului marchează verificarea `stale` și afișează `pending`, păstrând rezultatul anterior în istoric. Un simplu `checkedAt` nou nu invalidează verificarea. Confirmarea unei stări noi cere o revizie nominală nouă.

Raportul prezintă starea curentă a pregătirii, nu o reconstrucție a momentului rezervării. După rezervare, ocuparea capacității sau expirarea planului pot face verificarea anterioară stale. Acest lucru nu modifică lucrarea acceptată, oferta, plata sau istoricul.

## Admin și raportare

API: `/api/admin/assessment-qualification`, numai roluri cu drept `operations`, origine verificată la mutații și răspunsuri private fără cache. Financiar nu primește această suprafață operațională. Panoul este integrat în evaluările existente și păstrează tema crem. Clientul nu primește snapshoturile interne.

Raportul separat folosește cohorta **tuturor** cererilor create în intervalul Europe/Bucharest: inclusiv pending, unavailable, anulate/nepreluate și legacy_unknown. Filtrele sunt perioadă, localitate exactă, serviciu și client. Maximum 10.000 cereri; o cohortă mai mare este respinsă explicit, nu trunchiată.

Legăturile către rezervări sunt descriptive, fără rată de conversie declarată pe cereri eligibile. `eligibleConversion.percent` rămâne `null`; operatorul nu poate transforma acest jurnal într-un denominator comercial prin simpla alegere a unui status. Dashboardul Marketplace existent nu este rescris.

## Validare și operare

Teste: creare/replay fără backfill, rollback al markerului și auditului, actor nominal, conflict concurent de revizie, istoric imuabil, date necunoscute, staleness la schimbarea planului/capacității/cererii/dovezilor/orei, renovare, cohortă completă, date DST și refuzul trunchierii. Se verifică explicit absența modificărilor de ofertă, lucrare, plată și alocare.

Schema se inițializează aditiv împreună cu schema de evaluări; backupul obișnuit include jurnalul. Rollback-ul de cod nu șterge tabelul sau evenimentele. Cererile create de un cod vechi fără marker vor rămâne `legacy_unknown` când revine codul nou. Acceptanța browser și publicarea sandbox/LIVE se raportează separat de testele locale.
