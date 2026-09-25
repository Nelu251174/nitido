# Administrare consolidată — raportare, clienți și incidente

Data: 25.09.2026. Ramură: `feat/nitido-upgrade-consolidation`.
Acest document descrie codul candidat. Nu confirmă deploy, configurarea producției sau disponibilitatea în aplicațiile mobile.

## Performanță

Admin → **Performanță**, ancoră `/admin#performanta`.
Selectează intervalul inclusiv în fusul Europe/Bucharest. Filtrele suplimentare sunt localitate exactă, mod Standard/Express, tip spațiu, ID client și ID prestator.
Raportul include lucrările **create** în interval și starea lor **curentă**. Nu este o fotografie istorică a stării la finalul perioadei. Nu include lucrările Pro în agregatele Marketplace și nu transformă tipul spațiului într-o categorie de serviciu.

- Numere distincte pentru finalizate, așteptare, active, anulate și no-show.
- Reclamațiile confirmate folosesc ultima verificare a fiecărui dosar; o corecție poate elimina confirmarea anterioară. Mai multe dosare confirmate la aceeași lucrare se numără o singură dată. Confirmările se raportează pentru lucrări finalizate, iar sesizările neverificate separat.
- Marja folosește ultima revizie a costurilor efective pentru lucrările finalizate. Subtotalul confirmat nu este prezentat drept total dacă există date lipsă sau estimări. Discountul platformei se deduce o singură dată. Nu se presupun taxe, remunerații sau costuri zero.
- Datele prestatorului sunt în **observare**: lucrări asociate, finalizări, no-show, rating publicat după finalizare, sosiri măsurabile, existența ambelor tipuri de dovezi valide. Ratingul agregat nu certifică singur încasarea sau autenticitatea tuturor dovezilor. Dovezile numerotate aparțin firmei alocate.
- Ora sosirii este comparată strict cu ora programată. Nu este introdusă o toleranță nouă și datele absente nu sunt clasificate ca întârziere.
- `score: null`, `automaticAllocation: false`: niciun clasament nou, nicio modificare a Quality Index sau a distribuției Express.
- Peste 10.000 de lucrări, raportul refuză selecția cu 422 și solicită restrângerea filtrelor. Nu livrează un total trunchiat.

Nu sunt încă acoperite toate KPI-urile din §4: conversie pe cereri eligibile, mediane până la ofertare/alocare, acceptări raportate la invitații eligibile, servicii/zone, valoare și marjă pe întreaga durată a relației. Acestea nu trebuie deduse din acest raport cu denominatori improvizați.

## Clienți

Admin → **Clienți**, `/admin#clienti`.
Căutare după nume, email sau identificator, 50 de rezultate/pagină. Fișa afișează numai datele clientului selectat: date de contact, numărul proprietăților workspace active, soldul de credit existent, cereri, lucrări, referințe de plată, sesizări, evaluări și note interne. Fiecare istoric este paginat, fără expunerea parolelor sau a tokenurilor.

Etichetele sunt configurabile prin introducere explicită (maximum 12, câte 60 de caractere). Modificările cer motiv și revizia curentă; două editări concurente nu se suprascriu. Notele rețin autorul sesiunii administrative și data; corecțiile se fac printr-o notă nouă. Mutările au audit atomic: eșecul auditului anulează salvarea.

Etichetele sunt clasificări, **nu controale de acces**. O etichetă scrisă „blocat” nu blochează rezervarea și nu trebuie folosită ca substitut pentru un control antifraudă. Limitarea/blocarea clienților pe toate căile de creare, segmentarea avansată și raportul de valoare pe întreaga relație rămân lucrări distincte. Fișa nu mută proprietăți workspace în organizații Pro.

## Incidente: responsabil și termene

Admin → **Incidente**, `/admin#incidente`, apoi alege dosarul.
Secțiunea nouă gestionează severitatea (redusă/normală/ridicată/critică), numele responsabilului intern și nota internă. Numele este evidență operațională, nu acordă privilegii și nu înlocuiește un cont nominal de operator.

Politica de termene acceptă minute întregi sau câmpuri neconfigurate. Nu există valori activate implicit. Se cere motiv/referință de aprobare. Timpul de preluare curge de la raportarea cazului, iar țintele de răspuns prestator și rezoluție de la prima preluare. Toate sunt **ținte interne**, fără notificare automată sau promisiune contractuală.

Cazurile preluate păstrează versiunea și termenele inițiale la reatribuire sau schimbarea politicii. Cazurile nepreluate folosesc politica curentă. Un răspuns înregistrat după preluare de firma alocată oprește alerta de răspuns; o notă a clientului nu o oprește. Închiderea/rezolvarea oprește alertele active. Datele sunt evaluate când se încarcă dosarul; nu există escaladare automată sau email din acest modul.

Nota internă nu apare în `readVisitCare` pentru client/prestator. Concluzia verificării, destinată părților, rămâne în formularul separat. Revizia dosarului împiedică o actualizare administrativă să suprascrie tacit o modificare concurentă a remedierii. Istoricul politicilor și al responsabilităților este păstrat prin tabele append-only.

## Autorizare și schema nouă

Cele trei API-uri sunt `/api/admin/operational-report`, `/api/admin/customers`, `/api/admin/incident-triage`.
Toate cer sesiunea Admin verificată prin mecanismul existent și folosesc `private, no-store`. Mutațiile verifică originea, dimensiunea și forma corpului, actorul autentic și auditul în aceeași tranzacție SQLite imediată. Nu sunt acordate aceste permisiuni rolurilor Client, Firma sau Pro Viewer.

Inițializarea adaugă `incident_sla_policy`, `incident_triage`, `customer_classifications`, `customer_internal_notes`, indecși și triggere de retenție. Nicio tabelă existentă nu este ștearsă. Raportul de performanță este numai de citire. Revenirea de la acest pachet la părintele său nu cere eliminarea acestor tabele; păstrează-le pentru remediere înainte. Compatibilitatea cu un commit mult mai vechi decât părintele trebuie verificată separat.

Modelul Admin existent încă nu oferă întreaga separare Operator NITIDO / Manager / Financiar / Super Admin din brief. Aceste funcții nu sunt declarate livrate prin existența unui formular cu responsabil intern.
