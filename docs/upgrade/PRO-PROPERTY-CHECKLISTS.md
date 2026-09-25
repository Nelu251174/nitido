# Checklisturi Pro pe proprietate — §11, 25.09.2026

Candidat: `feat/nitido-pro-property-checklists`, continuă PR #83. Implementare de cod, fără publicare confirmată în sandbox sau producție.

## Comportament

În Pro → Proprietăți → fișa proprietății apare „Checklisturi pentru această proprietate”. Ownerul, Managerul și Operatorul organizației Pro pot publica liste numai pentru proprietățile din scope; sesiunea administrativă existentă păstrează accesul de administrare. Aceasta nu implementează separarea rolurilor interne NITIDO din §21.

Fiecare dintre cele cinci servicii Pro are propria listă, cu 1–40 de puncte distincte, de maximum 300 de caractere. Motivul modificării este obligatoriu. Preluarea punctelor standard în editor necesită o publicare nouă pentru a schimba regula activă; nu șterge istoricul.

Publicarea și auditul se salvează împreună. O versiune învechită primește 409. Replay-ul aceleiași cereri nu creează altă versiune, iar accesul la proprietate este verificat și înainte de replay. Viewer, Approver, Contact, partenerii fără rol organizațional și utilizatorii altor organizații nu pot configura lista sau citi istoricul ei. Istoricul este paginat în ordine descrescătoare, câte 20 de versiuni.

Lucrarea primește o copie a listei la creare; auditul `work.created` înregistrează serviciul și revizia sursă (0 pentru standard). Recurențele folosesc aceeași creare. Modificarea ulterioară a proprietății nu schimbă lucrările deja create, inclusiv ocurențele generate anticipat. Finalizarea continuă să ceară toate punctele din copia lucrării. Rework-ul existent păstrează lista lucrării.

Regulile foto existente rămân în vigoare; configurarea fotografiilor pe serviciu și tratarea punctelor Pro neexecutate cu motiv sunt cerințe separate, încă deschise. Instrucțiunile editorului interzic introducerea codurilor/parolelor în checklist; modulul de acces sensibil existent rămâne separat.

## Migrare explicită

Schema Pro 11 primește tabelul `pro_property_checklists`, triggere de imutabilitate și marcajul de migrare 12. Repetarea migrării este idempotentă. Nu se șterge și nu se recreează nicio tabelă existentă. Schema Marketplace, datele clienților și `checklist_json` din lucrările Pro existente sunt păstrate. Instalările noi primesc 11 și 12 în aceeași tranzacție.

După backup coerent și verificarea restaurării pe mediul țintă, în containerul candidatului:

```sh
NITIDO_PRO_DB_PATH=/app/data/nitido.db node /app/scripts/pro-migrate.mjs
```

Calea se folosește numai dacă este baza deja verificată a acelui mediu. Refuzul unei scheme legacy nu se ocolește. Până la migrarea 12, editorul anunță indisponibilitatea configurării, publicarea răspunde 503 și lucrările noi continuă să utilizeze listele standard. Nu există DDL în rutele HTTP.

Rollback-ul codului la părintele PR #83 poate lăsa tabelul aditiv în bază; acel cod nu configurează liste personalizate pentru lucrări noi. Listele deja copiate pe lucrări sunt compatibile cu cititorul existent. Compatibilitatea și restaurarea efectivă pe infrastructura țintă rămân de verificat.

## Probe automate și acceptanță sandbox

Testele acoperă migrarea repetată cu o lucrare Pro existentă, lipsa modificării datelor, validarea listelor, publicări concurente, imutabilitate, rollback la eroare de audit, scope pe proprietate, roluri fără acces, revocarea replay-ului, istoricul paginat și generarea recurentă fără rescrierea snapshoturilor.

În sandbox rămân de parcurs cu conturi distincte:

1. Owner și Manager limitat la o proprietate: publicare, istoric, conflict la două ferestre.
2. Viewer/partener/altă organizație: editor și istoric inaccesibile, inclusiv prin API direct.
3. Lucrare veche, lucrare nouă și recurență: compararea listelor înainte/după publicare; prestatorul confirmă lista proprie lucrării.
4. Interfață crem la 360/390/430 px și desktop: editor, tastatură, erori, paginarea istoricului.
5. Backup/restaurare și migrare repetată pe copia bazei sandbox; confirmarea aceluiași SHA în CI și în container.

Aceste probe operaționale nu sunt marcate trecute pe baza testelor locale.
