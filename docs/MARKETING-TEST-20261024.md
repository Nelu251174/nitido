# Marketing — prima etapă, numai în mediul de test

Baza este commitul `fdb571e395ec664cc510b4787acb6a2b41f40901`, identificat prin publicarea Coolify `umzp9gndcz1qz6m1vt5uv1i1`, terminată cu succes la 24 octombrie 2026, 12:52:23 UTC (15:52:23 în România). Metadatele aplicației LIVE confirmă același SHA. `main`, aflat la `2101988`, nu a fost folosit ca bază. În timpul implementării, sandboxul a primit remedierea `31f5cd7a85379234fdea0177e813971cc63c33bd` pentru inițializarea rutelor de fotografii. Ramura Marketing păstrează și această publicare de test, pentru a nu o suprascrie.

## Acces și funcții

Administratorul intră în **ADMIN → Marketing** pe `https://sandbox.nitido.ro/admin/marketing`. Pagina și toate rutele cer permisiunea existentă `super_admin`, cu sesiunea ADMIN și MFA existente. Operatorul, managerul, financiarul și conturile de client/firmă nu primesc acces. Modulul este dezactivat pe originea LIVE, inclusiv dacă rutele ar fi copiate accidental acolo. Originea este citită din configurația serverului, nu din antetele cererii. În dezvoltare este permis un URL explicit localhost.

- **Contacte:** clienți business, firme de curățenie și persoane fizice; adăugare manuală, filtre, paginare, export CSV; actualizarea stării, acordului și observațiilor.
- **Colectare firme:** import CSV cu previzualizare și selectare după categorie/localitate; verificare ANAF pentru maximum 20 de CUI-uri cunoscute, cu previzualizare înainte de salvare.
- **Persoane fizice:** email și dovada acordului pentru marketing sunt obligatorii la adăugare/import. Retragerea ulterioară a acordului marchează contactul „Nu contacta”.
- Duplicate după email normalizat sau CUI, în aceeași categorie, sunt omise. Reimportul nu suprascrie datele și stările existente. Nici colectarea, nici salvarea nu creează un cont de client sau de partener.

ANAF furnizează identitatea și localitatea, fără email sau acord pentru marketing. Nu oferă aici o căutare a tuturor firmelor dintr-un oraș. Categoria aleasă de administrator trebuie verificată. Firmele radiate, localitățile necunoscute și cele care nu corespund filtrului sunt excluse. Nu există crawler web, căutare automată de emailuri sau un furnizor extern nou.

## Date și limite

Tabelul nou `marketing_contacts` și indicii săi se creează la prima operațiune autorizată în sandbox. Schema este aditivă și nu schimbă tabelele existente. Importurile sunt atomice; erorile de validare sau audit anulează salvarea. Evenimentele de audit nu includ adrese, numere de telefon sau dovezi de acord. Exporturile sunt private și protejează împotriva formulelor de spreadsheet.

CSV: maximum 250 KB și 200 de contacte per lot. Antetul folosește `name,category,email,phone,city,cui,website,source,consent,consentEvidence,notes`. Coloanele obligatorii sunt `name,category,city,source`; identificarea necesită email sau CUI. Categorii: `business`, `cleaning`, `individual`. Acord: `not_recorded`, `granted`, `withdrawn`. Câmpul `consentEvidence` documentează sursa și data acordului. Exportul este limitat la 5.000 de contacte selectate.

Nu există rute de trimitere, programare, campanii, tracking sau integrare în coada de notificări. Acestea rămân în afara primei etape. Nu s-au schimbat tarifele, plățile, rezervările sau notificările existente.

## Validare și publicare de test

Testele izolate acoperă accesul ADMIN, protecția originii, izolarea LIVE, limitele de cerere, importul fără scriere la previzualizare, validarea acordului, duplicatele, retragerea acordului, concurența actualizărilor, auditul atomic, exportul și răspunsurile ANAF simulate. Buildul Next.js și verificarea ESLint a fișierelor noi trebuie să treacă înaintea publicării.

Verificarea în Chromium folosește un ADMIN sintetic cu MFA și contacte sintetice, pe server local, cu serviciile de email dezactivate. Capturile desktop/mobil și rezultatul testului sunt păstrate în `/workspace/nitido-marketing-evidence`.

Singura țintă de deployment este aplicația Coolify sandbox `civaeb8joydtchvzlen6pivq`. Sursa anterioară a sandboxului este `31f5cd7a85379234fdea0177e813971cc63c33bd`. Înainte de deployment se face un checkpoint SQLite pe volumul sandbox; scriptul refuză orice altă origine. Revenirea se face la sursa anterioară, păstrând volumul și contactele deja salvate; nu se restaurează un backup peste baza care rulează.

Aplicația LIVE `zxnelxi2cejranyvfpw0scac` se citește numai pentru verificarea SHA-ului; nu este modificată și nu primește deployment. Verificarea remote finală acoperă sănătatea aplicației și refuzul cererilor neautentificate. Autentificarea ADMIN completă este verificată în mediul local izolat; nu sunt extrase credențiale ADMIN din server.
