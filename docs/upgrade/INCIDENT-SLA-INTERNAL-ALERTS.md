# Alerte și escaladări SLA interne

Acest pachet automatizează verificarea termenelor deja configurate în `incident_sla_policy` și capturate în `incident_triage`. Nu introduce praguri comerciale, termene promise clientului, transport email/SMS/WhatsApp sau schimbări financiare.

## Activare și operare

Workerul este dezactivat implicit. Activarea cere explicit `NITIDO_INCIDENT_SLA_ALERTS_ENABLED=true` și secretul existent `CRON_SECRET`, de minimum 32 de caractere. Endpoint: `POST /api/cron/incident-sla`, cu headerul `x-cron-secret`. Se reutilizează secretul cron existent, fără publicarea lui și fără crearea unui secret nou. Configurarea schedulerului rămâne o operațiune de deploy distinctă de existența codului.

Corpul cererii nu poate alege un dosar, un moment sau un termen. Workerul folosește timpul serverului și sursele autorizate din SQLite. O rulare verifică cel mult 250 de dosare; cursorul persistent continuă la apelul următor și revine la început după încheierea ciclului. Aceasta este o limită tehnică de lucru, nu un prag SLA. Întregul lot folosește o tranzacție SQLite writer: procesele concurente nu pot crea aceeași alertă de două ori. La eșecul bazei sau auditului, lotul și cursorul revin împreună, iar apelul poate fi repetat.

## Surse și tipuri

- Preluare: termenul calculat de la crearea dosarului cu politica actuală, numai până la prima preluare. Escaladare internă către management.
- Răspuns prestator: termenul capturat de la prima preluare, numai când există o firmă atribuită și nu există răspuns al acelei firme după preluare. Urmărire de către echipa operațională.
- Rezoluție: termenul capturat de la prima preluare. Escaladare internă către management.

Cazurile preluate păstrează versiunea și termenele inițiale. Reatribuirea nu repornește ceasul și nu dublează alerta. Pentru cazurile nepreluate, o schimbare a politicii poate face alerta anterioară neaplicabilă; istoricul rămâne nemodificabil.

Datele lipsă, nevalide sau incompatibile cu ancora și minutele configurate nu generează alerte. Timestamps SQLite fără offset se interpretează UTC; interfața afișează ora României. Exact la termen nu este încă depășire. Cazurile `closed` și `resolved` nu generează alerte active.

## Inbox, autorizare și preluare

Inboxul este în componenta crem existentă `AdminIncidentTriage`, în pagina administrativă și în dosarul selectat. `GET /api/admin/incident-alerts` cere identitate administrativă nominală cu permisiunea `operations`; se poate filtra exact cu `caseId`. Răspunsurile nu se cachează.

La fiecare citire și înaintea preluării se revalidează dosarul, politica, termenul și răspunsul prestatorului. O alertă devenită neaplicabilă rămâne în istoric, dar nu mai apare ca activă. Responsabilul afișat este cel actual; responsabilitatea scrisă în triage nu acordă privilegii.

`POST /api/admin/incident-alerts` cere aceeași identitate, origine validă, identificatorul alertei, versiunea dosarului și o notă internă. Actorul nu se poate transmite din client. Alertele de răspuns prestator pot fi preluate de Operator; escaladările de preluare și rezoluție cer Manager operațional sau Super Admin. Financiarul și rolurile client/prestator nu au permisiunea `operations` pentru acest inbox.

Preluarea este numai confirmare internă de urmărire. Nu închide dosarul, nu soluționează reclamația, nu schimbă termenul și nu modifică plata. Aceeași cerere, repetată de același actor cu aceeași notă, întoarce confirmarea existentă fără al doilea audit. O preluare concurentă de alt actor primește conflict. Dosarele sau termenele schimbate înainte de prima preluare primesc conflict și cer reîncărcare.

Lista refuză explicit peste 1.000 de înregistrări candidate, cu cerere de deschidere a unui dosar; nu trunchiază și nu declară în mod fals că inboxul este complet sau gol. Un dosar cu istoric excepțional de mare trimite operatorul la auditul administrativ.

## Date, audit și revenire

Schema leaf `INCIDENT_SLA_ALERT_SCHEMA` este aditivă: alerte imuabile, confirmări nominale imuabile și cursor tehnic. Unicitatea alertei este `(case_id, kind, policy_revision, due_at)`, iar versiunea triage sursă este păstrată pentru audit. Inserarea alertei și evenimentul `incident.sla.alert` se salvează atomic. Confirmarea și `incident.sla.acknowledge` sunt de asemenea atomice.

Revenire operațională: setează flagul la `false` și oprește programarea acestui endpoint. Înregistrările existente se păstrează; codul anterior nu depinde de ele. Dezactivarea workerului nu șterge auditul sau confirmările și nu schimbă termenele cazurilor.

## Validare

Testele acoperă lipsa configurației, activarea și secretul, termene DST cu TZ UTC/Europe-Bucharest, stare închisă, răspuns al firmei asignate, firmă lipsă, schimbarea politicii și responsabilului, date corupte, scanare pe mai multe loturi, lock concurent real între conexiuni SQLite, reluare fără duplicate, roluri de acknowledgement, versiune veche, origine nevalidă și rollback la eșecul auditului.

Validarea locală și existența endpointului nu demonstrează că schedulerul este activ în sandbox sau LIVE. Activarea, execuțiile reale din scheduler și verificarea browserului pe roluri se consemnează separat în raportul de deploy.
