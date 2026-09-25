# Verificare SQLite și restaurare izolată

## Instrument livrat

`scripts/verify-database-backup.mjs` este inclus și în imaginea Docker. Comanda cere explicit sursa și un director nou, al cărui părinte există și este accesibil:

```sh
node scripts/verify-database-backup.mjs /cale/nitido.db /cale/drill-nou
```

Nu folosi un director deja existent. Instrumentul nu îl suprascrie. În container, scriptul se află în `/app/scripts/verify-database-backup.mjs`; alege un director persistent și protejat, disponibil utilizatorului containerului.

Sursa este deschisă read-only, cu `fileMustExist`. API-ul de backup SQLite include datele confirmate din WAL; nu copiază pur și simplu fișierul `.db` activ și nu forțează checkpoint pe sursă. Rezultatul este `snapshot.db`; restaurarea de probă este un fișier separat, `restored.db`. Fișierele au mod 0600, directorul 0700.

Validările sunt `integrity_check`, `foreign_key_check`, egalitatea schemei, numărul de rânduri pe fiecare tabelă și SHA-256 al fișierelor. Hashurile sunt calculate în flux, fără încărcarea întregii baze în RAM. Numai după toate verificările apare `verification.json` cu `status: passed`. Nu conține rândurile clienților, parole, coduri de acces sau valori ale secretelor. Eșecul returnează cod 1; fișierele parțiale nu sunt dovezi de succes și nu sunt șterse automat.

Un `passed` confirmă **numai această copie SQLite**. Nu confirmă fișierele foto, secretul de criptare Pro, Stripe, cronurile, compatibilitatea imaginii Docker sau funcționarea interfeței după restaurare.

## Validare pe infrastructura țintă — încă necesară

1. Identifică SHA-ul imaginii, baza activă și volumele reale. Păstrează inventarul fără a afișa secretele.
2. Pregătește o fereastră coerentă pentru baza de date și fișierele încărcate. Evită modificarea sau ștergerea fotografiilor pe durata inventarierii/copierii. Copia SQLite online singură nu face volumele externe atomice.
3. Rulează instrumentul pe baza țintă. Păstrează logul, ora, hashurile și durata. Eșecurile de FK sau integritate se investighează; nu se elimină verificarea pentru a obține PASS.
4. Copiază separat volumele de fotografii și documente private, verifică manifestul și hashurile și păstrează configurația necesară într-un gestionar de secrete. Nu comite dumpuri, date personale sau chei în Git.
5. Pornește restaurarea într-un mediu izolat, cu cronuri și integrări externe oprite; nu conecta copia la plăți sau notificări reale. Verifică totalurile și deschiderea unor fotografii autorizate pe roluri.
6. Verifică fluxurile aplicației pe imaginea candidată și revenirea la imaginea compatibilă anterioară. Nu reimporta o copie veche peste date noi fără reconcilierea lor.

## Rollback

Pachetul curent are numai schema suplimentară descrisă în `CONSOLIDATED-OPERATIONS.md`. Pentru revenirea la părintele PR-ului, păstrează tabelele și istoricul; nu rula DROP. Dezactivează funcțiile experimentale prin mecanismele existente și restaurează imaginea compatibilă. Pentru rollback-ul întregului upgrade, folosește inventarul complet al migrărilor A1–A4 și o restaurare izolată înainte de operația reală. Nu presupune că orice SHA vechi poate citi toate stările nou-create.

## Probe automate

```sh
npm run test:backup
```

Testele folosesc doar baze temporare sintetice: rânduri confirmate în WAL, păstrarea relațiilor/triggerelor/istoricului, sursă nemodificată, sursă lipsă, destinație existentă, FK invalide și sursă coruptă. Restaurarea reală a volumelor Coolify rămâne neexecutată în această sesiune.
