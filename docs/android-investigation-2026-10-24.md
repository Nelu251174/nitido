# Investigație Android — 24 octombrie 2026

Investigația vizează exclusiv `ro.nitido.app` și închiderea imediată raportată de beneficiar. Versiunea efectiv instalată pe telefon și cauza crash-ului nu sunt încă identificate. [PR #139](https://github.com/Nelu251174/nitido/pull/139) continuă sursa traducerilor fără schimbări ale aplicației publicate.

## Corecții ale diagnosticului

Contractul oficial Play Developer Reporting folosește componente `google.type.DateTime` (`interval.startTime.year`, `.month`, `.day`, `.hours`, `.utcOffset`), nu parametri ISO `interval.startTime`/`endTime`. Instrumentul anterior trimitea forma greșită. Extragerea ignora și câmpurile oficiale `firstAppVersion`/`lastAppVersion`.

Noua probă folosește contractul corect, verifică separat cele două identități din GitHub și păstrează numai clasele excepțiilor, cadrele de cod și versiunile. Mesajele excepțiilor, rapoartele brute și credențialele sunt eliminate din export. Șapte teste izolate verifică filtrarea, intervalul, versiunile, limitele serviciilor și ștergerea editului Play temporar, inclusiv la eroare.

Proba poate activa exclusiv API-urile Reporting/Publisher în proiectul existent `nitido-508720`, numai dacă identitatea are deja permisiunea `serviceusage.services.enable`. Nu acordă roluri IAM, nu modifică alte proiecte și nu publică release-uri. În execuția reală nu a fost activat niciun API.

## Acces real verificat

Execuția [40070075744](https://github.com/Nelu251174/nitido/actions/runs/40070075744) confirmă:

- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` lipsește din secretele disponibile robotului.
- `FIREBASE_SERVICE_ACCOUNT_JSON` este prezent și aparține proiectului NITIDO, dar nu are dreptul de activare a serviciilor.
- Publisher și Reporting răspund HTTP 403, `SERVICE_DISABLED`. Citirea stării serviciilor este, separat, refuzată cu `AUTH_PERMISSION_DENIED`.
- Nu au fost schimbate roluri IAM, release-uri, credențiale sau date ale clienților.

Prin acest acces nu se pot afla versiunile curente din canalele Play, nu se poate prelua stack trace-ul dispozitivului și nu se poate încărca o actualizare.

## Pachete și verificări noi

A fost recuperat artefactul istoric exact din [execuția 37972301860](https://github.com/Nelu251174/nitido/actions/runs/37972301860): versiunea **24 / 1.0**, identitate `ro.nitido.app`, țintă HTTPS `nitido.ro`, minSdk 24, targetSdk 36, SHA-256 `9e706599da1b86ee580a907b43916bbda1cec5cc5f06a2a7892a0552bea985a4`. Nu conține configurația Firebase. Această lipsă nu este declarată cauza crash-ului la pornire.

Ambele AAB-uri au trecut verificarea criptografică a tuturor celor 547 de intrări, cu certificatul de upload existent. Testele de emulator folosesc separat un certificat temporar, fără exportarea cheii originale.

Candidatul **26 / 1.0.3**, SHA-256 `fa77f2dc4f7ef4f4b353911143d00f7e47d9213399b796f2e0e0a5f5a0816439`, conține configurația Firebase și fusese deja verificat la pornire împreună cu versiunea 25. Nu au fost reluate aceste probe simple fără o ipoteză nouă.

Noua probă verifică versiunea istorică 24 și actualizarea 24 → 26 cu `adb install -r`, folosind aceeași semnătură de test temporară. Nu șterge datele aplicației între versiuni. Verifică permisiunea de notificări deja acordată, revenirea din fundal, două rotații, mod luminos/întunecat și pornire în mod avion cu Wi-Fi/date mobile dezactivate, urmată de revenire online. Nu se autentifică în conturi și nu trimite notificări.

Pe Android 16 / API 36, toate cele **14 verificări** au trecut. Pe Android 15 / API 35, prima probă a confirmat procesul pornit, însă nu a identificat WebView-ul în arborele UI; bufferul de crash nu conține o excepție NITIDO. Reluarea instrumentată [40070906153](https://github.com/Nelu251174/nitido/actions/runs/40070906153) a trecut toate cele 14 verificări, inclusiv vizibilitatea WebView, tranziția 24 → 26 și modul offline. Rezultatul inițial rămâne consemnat; nu este declarat crash reprodus sau cauză remediată. În total sunt 28 de verificări suplimentare reușite pe cele două versiuni Android.

Căutarea integrărilor disponibile nu a găsit un instrument direct Play Console/IAM utilizabil. Căutarea limitată la emailuri Google despre NITIDO nu a găsit confirmări de publicare. Nu s-au consultat conversații sau emailuri fără legătură.

## Ce rămâne deschis

Confirmarea exactă a binarului instalat și citirea raportului real de crash depind de accesul autorizat Play Console/Reporting. Lipsa acelui acces împiedică validarea unei remedieri și publicarea automată. Dovezile de emulator nu închid verificarea telefonului Samsung raportat. Nu a fost publicat un binar nou sau o schimbare web prin această investigație.

Rezultatele structurate sunt în [fișierul de dovezi](evidence/android-investigation-20261024.json).
