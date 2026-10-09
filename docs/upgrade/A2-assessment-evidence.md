# A2 — Fotografii private și verificarea evaluării

Continuă PR60. Implementare pentru sandbox; fără deploy, modificare de chei sau plăți externe.

## Flux implementat

Clientul încarcă fotografii direct în cererea de evaluare. Se reutilizează procesarea existentă: verificarea formatului real, limita de 8 MB, decodare, eliminarea metadatelor și limitarea dimensiunilor. Maximum 10 fotografii per cerere, cu limitarea de trafic existentă.

Fotografia este legată de cererea proprietarului în aceeași tranzacție cu înregistrarea și schimbarea versiunii cererii. Eșecul scrierii pe disc anulează datele inserate; eșecul tranzacției elimină fișierul nou. Fotografiile atașate nu sunt tratate ca fișiere temporare orfane și nu pot fi mutate ulterior pe o lucrare.

Accesul folosește ruta privată existentă /api/uploads/[id]. Clientul proprietar și Admin autentificat pot citi fotografiile. Alte conturi client și firmele nu au acces la fotografiile de evaluare fără lucrare. Nu sunt create URL-uri publice.

Admin deschide fotografiile, confirmă sau respinge dovezile și completează motivul intern. Decizia păstrează operatorul, momentul, versiunea cererii și lista exactă de fotografii. Clientul primește starea verificării, fără nota internă sau identificatorul operatorului.

Încărcarea unei fotografii noi sau schimbarea cererii invalidează verificarea veche și calculul intern legat de vechea versiune. Operatorul trebuie să actualizeze cererea, să verifice dovezile și să salveze o revizie actualizată a calculului.

## Renovare

Publicarea unei oferte pentru renovare cere cel puțin o fotografie procesată valid și confirmarea Admin pentru setul complet curent. Brief-ul nu stabilește un număr minim comercial; operatorul verifică dacă setul este suficient pentru ofertare. Nu este o verificare automată a conținutului vizual.

Oferta păstrează referința verificării și fotografiile luate în considerare. Acceptarea este blocată dacă verificarea a fost retrasă sau înlocuită după publicare. Termenii unei oferte acceptate rămân istorici.

Acest pachet permite evaluarea și ofertarea renovării, dar NU activează rezervarea automată pentru renovare. Programarea asistată, executarea și legătura completă cu plata acestor lucrări rămân de implementat. Reutilizarea fotografiilor de evaluare drept dovezi de sosire/finalizare este interzisă.

## Operare Admin

1. Deschide cererea și secțiunea Fotografii pentru evaluare.
2. Deschide fiecare fotografie și verifică suficiența dovezilor.
3. Introdu motivul intern și confirmă verificarea sau solicită completări.
4. Actualizează lista cererilor pentru versiunea curentă, apoi salvează calculul ofertei.
5. Publică oferta după verificarea marjei și a termenilor.

## Date, activare și rollback

Se adaugă assessment_photos și assessment_photo_reviews. Datele existente nu sunt șterse. Relațiile și reviziile sunt protejate împotriva rescrierii/ștergerii; fotografiile legate sunt protejate împotriva modificării sau reasignării. Curățarea automată a fișierelor orfane exclude aceste fotografii și folosește tranzacție pentru a evita ștergerea concurentă cu atașarea.

Mutațiile noi cer activarea sandbox existentă NITIDO_MANUAL_OFFERS_SANDBOX. Nu a fost schimbată nicio variabilă pe server. Înainte de rollback, dezactivează mutațiile și păstrează tabelele, fișierele și istoricul. Nu reveni la vechea curățare a orfanilor fără excluderea fotografiilor de evaluare: acestea au job_id NULL în mod intenționat. Resetarea globală de istoric poate fi refuzată de relațiile și protecțiile noi; acest pachet nu ocolește protecțiile pentru a permite ștergerea.

## Verificări

457 teste în 37 fișiere, în UTC și Europe/Bucharest. Next typegen, TypeScript și ESLint țintit fără erori. Teste SQLite/API pentru proprietate, roluri, note interne, revizii, limite, publicare/acceptare renovare și rollback. Testele de upload folosesc operații de disc și decodor simulate pentru a injecta eșecuri; nu sunt prezentate drept test vizual sau test real de încărcare pe server.

PR60 avea CI verde la începutul etapei. Verificarea browser desktop/mobil și E2E în sandbox rămâne restantă din cauza blocajului de acces consemnat anterior. Nu este declarată finalizarea integrală a brief-ului sau pregătirea pentru LIVE.
