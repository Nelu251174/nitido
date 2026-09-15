# E4 — Sincronizare automată iCal

## Livrare

Modulul **Curățenie între rezervări**, `/client/host`, include o conexiune iCal per proprietate. Proprietarul introduce linkul privat de export și confirmă dreptul de conectare. Poate adopta explicit sursa unui import manual existent: se păstrează ID-urile evenimentelor și legăturile cu lucrările. Înlocuirea linkului este destinată aceluiași calendar/proprietăți.

Prima descărcare este programată la următoarea trecere a workerului (în mod normal în circa un minut). Sincronizare la 15 minute după o reușită, cu buton manual limitat la o cerere/minut. Pauză, reluare, deconectare (șterge URL-ul salvat, păstrează evenimentele și lucrările). Se afișează domeniul sursei, ultima reușită, următoarea încercare, numărul evenimentelor și erori inteligibile. Pagina actualizează statusul la 30 secunde cât timp este vizibilă; workerul rulează independent de browser.

## Preluarea modificărilor

- Evenimente individuale cu UID stabil, date întregi sau timestamp UTC. Datele întregi folosesc orele proprietății în România. Titlurile, descrierile și datele oaspeților nu se copiază.
- Upsert pe proprietate/sursă/UID, tranzacție imediată; ID-ul evenimentului și lucrarea rămân asociate. O sincronizare fără schimbări păstrează revizia calendarului.
- Anulările explicite și perioadele devenite transparente sunt preluate. Nicio rezervare de curățenie, plată, anulare de lucrare sau reprogramare automată.
- Opțiunea **export complet** este implicit dezactivată. Când este confirmată de proprietar, evenimentele viitoare absente din intervalul reprezentat de primul/ultimul eveniment activ din export sunt anulate după două descărcări valide consecutive. Evenimentele din afara intervalului, cele începute deja și cele lipsă dintr-un export gol sunt păstrate. Limitele exporturilor furnizorilor nu sunt presupuse infinite.
- Descărcările eșuate sau calendarele invalide nu modifică evenimentele; întrerup seria de confirmări pentru absențe. Reîncercări 15/30/60/120/240/360 minute; resetare după succes.
- Parserul verifică închiderea structurii VCALENDAR/VEVENT, identificatori/proprietăți duplicate, limite 1 MB/1000 evenimente și date valide. Recurențele RRULE/RDATE/EXDATE/RECURRENCE-ID sunt respinse; nu se importă parțial un export nesuportat. Formatul este bazat pe [RFC 5545](https://www.rfc-editor.org/rfc/rfc5545).

## Execuție și protecții

- Worker Node pornit prin `src/instrumentation.ts` în containerul persistent Coolify; scanare la 60 secunde, maximum 20 conexiuni per trecere. Nu pornește în compilare. La restarte sunt preluate conexiunile scadente.
- Lease SQLite de 60 secunde, token și versiune. Workerul și butonul manual nu aplică simultan același export. Pauza/deconectarea/înlocuirea linkului invalidează descărcările deja în curs.
- Serverless necesită alt scheduler înainte de migrare; livrarea este pentru serverul persistent existent. Sub încărcare sau la erori ale furnizorilor actualizarea poate întârzia peste intervalul nominal.
- API client autentificat și proprietar al proprietății active de tip host; verificare de origine și limitare mutații. Firmele nu au acces.
- URL criptat AES-256-GCM, asociat ID-ului conexiunii; cheie aleatoare 32 octeți în `data/ical-url.key` (0600), pe același volum persistent ca SQLite. **Backup-ul/restaurarea trebuie să includă întregul volum data, inclusiv cheia**, nu numai nitido.db. Pierderea cheii necesită reconectarea linkurilor. Nu este citită sau afișată la instalare.
- API-ul returnează explicit numai câmpuri de status, fără URL/cipher/lease. Erorile rețelei nu sunt logate cu URL-uri. Datele brute ICS nu sunt salvate.
- HTTPS exclusiv pe port standard, fără userinfo; `webcal:` este convertit la HTTPS. DNS IPv4 public verificat pentru fiecare redirecționare, adresă fixată la conectare, TLS verificat cu hostname original. IP-urile literale și intervalele locale/private/metadata/multicast/rezervate sunt respinse. Maximum 3 redirecționări, 25s buget HTTP, DNS limitat, maximum 1 MB, fără compresie. Serverele exclusiv IPv6 nu sunt suportate în această livrare.
- Schema aditivă `workspace_ical_connections` și `workspace_ical_missing`. Fără modificarea comisioanelor, plăților sau aprobărilor.

## Validare și limite

Revizuire de sursă, TypeScript, ESLint pe fișierele noi și compilare Next.js. Conform instrucțiunii Owner, nu sunt reluate teste funcționale/plăți și nu se creează evenimente sau rezervări de probă în conturi. O sincronizare cu un calendar privat real necesită conectarea linkului de către proprietar; aceasta nu este confirmată doar prin build sau healthcheck.

E4 rămâne parțială: activarea independentă/pilot pe organizație și raportarea istorică extinsă sunt separate. Fără publicare App Store/Google Play sau modificarea ramurii de producție.
