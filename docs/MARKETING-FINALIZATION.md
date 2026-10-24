# Marketing — colectare publică și procesare campanii

Bază: `34fd27da0bb471029a9a67ed8e42e5f08baabcd3`, versiunea sandbox confirmată în Coolify la 24 octombrie 2026. `main` nu este baza acestei modificări. Implementarea privește exclusiv Marketing; autentificarea ADMIN și celelalte module sunt păstrate.

## Flux disponibil

1. ADMIN → Marketing → Colectare firme: CSV, verificare CUI prin ANAF, căutare OpenStreetMap după localitate/domeniu sau verificarea site-urilor cunoscute. Pentru căutarea publică există o coadă persistentă, progres, anulare, maximum 20 de firme/rulare și 20 de căutări/zi. Căutările sunt serializate; răspunsul Overpass este limitat la 250 KB. Surse: [Overpass](https://wiki.openstreetmap.org/wiki/Overpass_API), [contact:email](https://wiki.openstreetmap.org/wiki/Key:contact:email).
2. Colectorul verifică robots.txt, citește pagina și cel mult două pagini de contact din același site. Verifică DNS, respinge adrese interne și limitează redirecționările, timpul și dimensiunea răspunsului. Conexiunile directe folosesc IP-ul validat. Proxy-urile configurate sunt respectate și trebuie să impună propriile restricții împotriva destinațiilor interne.
3. Rezultatele sunt previzualizate înainte de salvare, cu sursă și atribuire OSM. Firmele fără email pot fi păstrate dacă au website/CUI. Nu sunt inventate emailuri și nu se presupune acordul. OpenStreetMap nu cuprinde toate firmele; clasificarea, localitatea și datele necesită verificare. Colectarea automată nu include persoane fizice.
4. Contacte: clienți business, firme de curățenie, persoane fizice; editare, filtre, export și verificare în lot. Campaniile includ numai emailuri unice, contacte verificate și acord documentat. Retragerea acordului/„Nu contacta” creează și o blocare globală persistentă, care rezistă editării sau reimportului. Reactivarea este o acțiune separată, cu dovadă nouă, confirmarea emailului și audit. Reclamațiile/respingerea la furnizor necesită investigație înainte de reactivare.
5. Setări: expeditor, răspunsuri, adresă poștală, cost estimat, limită zilnică și bugete. Campanie: ciornă → previzualizare → pregătire → coadă imediată/programată. Pauza ține mesajele în așteptare; arhivarea sau schimbarea conținutului anulează mesajele vechi rămase. O adresă nu este pusă de două ori în aceeași campanie/mod. Pentru o expediere nouă se creează altă campanie.
6. Coada de test folosește aceeași selecție, programare, blocare și generare a mesajelor, apoi salvează intern HTML-ul; nu apelează furnizorul. Mesajele capturate și rapoartele se văd în Rezultate. Simularea veche rămâne o verificare separată de selecție.
7. Procesorul verifică din nou eligibilitatea înaintea fiecărui mesaj, aplică limite zilnice/bugete cumulate și folosește un lease în SQLite pentru excluderea procesării concurente. Loturi de cel mult 5 mesaje; scheduler în procesul Node la 15 secunde, numai în sandbox. Coada/programarea persistă la restart. Trimiterile întrerupte devin „Rezultat neconfirmat” și nu sunt retrimise automat.
8. Adaptorul real folosește [Resend](https://resend.com/docs/api-reference/emails/send-email), chei de idempotență stabile și timeout. „Acceptat de furnizor” este separat de „Livrat”. Evenimentele [webhook](https://resend.com/docs/webhooks/verify-webhooks-requests) sunt verificate prin Svix pe corpul original, cu protecție timestamp/replay; evenimentele sosite înaintea răspunsului de expediere sunt reconciliate. Bounce/complaint blochează adresa global. Rapoartele nu inventează deschideri sau clicuri.
9. Fiecare mesaj procesat primește un link personal de dezabonare. Tokenul este transmis în fragmentul URL, păstrat în memorie în pagină și verificat prin hash. GET-ul/scannerele nu dezabonează; confirmarea POST oprește toate mesajele Marketing ale adresei. Nu declarăm suport RFC 8058 one-click.

## Activare reală — dezactivată în această livrare

Default: `NITIDO_MARKETING_DELIVERY_ENABLED` absent/false. UI și API refuză lansarea reală. Niciun test nu trimite emailuri reale și nu activează acest flag. Nu se publică LIVE.

Pentru o etapă ulterioară autorizată de expediere: cont/domeniu expeditor verificat la Resend, `RESEND_API_KEY`, webhook Resend la `https://sandbox.nitido.ro/api/marketing/webhook` cu evenimente delivered/bounced/complained și `NITIDO_MARKETING_WEBHOOK_SECRET` din furnizor. Abia apoi se poate activa flagul și confirma explicit o campanie în ADMIN. Setările din UI nu pot activa flagul sau expune cheile. Costurile sunt estimări introduse de administrator, nu facturi/tarife confirmate de furnizor.

Dacă furnizorul refuză mesajul, este „Refuzat”; timeout/5xx/rezultat ambiguu este „Neconfirmat”, fără retry automat. Acestea necesită verificarea furnizorului. Depășirea limitei zilnice/bugetului păstrează mesajele în coadă; rapoartele arată această limitare. Nu există raportare de deschideri/clicuri în această versiune.

## Verificare

- 77 teste automate trecute pentru contactele existente plus colector, DNS privat, robots, surse, cote, procesor, concurență, programare, pauză, idempotență, bugete, dezabonare, reactivare explicită și webhookuri semnate. Adaptorul Resend este verificat cu răspunsuri simulate, fără apeluri reale.
- Build complet Next.js, verificările i18n pentru 9 limbi, TypeScript și ESLint pe codul Marketing.
- Chromium pe buildul production cu bază sintetică și trafic extern blocat: buton ADMIN, colectare de pe un site fixture prin interfață, previzualizare fără scriere, salvare, cele trei categorii, verificare contacte, setări, campanie, coadă de test, mesaje capturate, dezabonare publică, reverificarea eligibilității, persistență după restart și mobil 390 px.
- Verificarea opțională a site-ului public real din mediul cloud a întâlnit `EAI_AGAIN` la DNS înainte de conectare. Acest rezultat nu este prezentat ca o colectare publică reală reușită. Disponibilitatea sursei externe nu este garantată; rezultatele funcționale ale colectorului sunt testate cu răspunsuri deterministe.
- Livrarea la căsuțe poștale reale nu este verificată, conform interdicției de expediere din această etapă.

Diagnosticul manual `scripts/marketing-public-check.cjs` poate verifica același colector instalat față de site-ul public propriu nitido.ro, printr-o previzualizare temporară, fără salvare de contacte sau campanii. Nu activează trimiterea.

Datele de test și capturile sunt în dovezile locale `/workspace/nitido-marketing-final-evidence`; nu includ parole reale, chei furnizor sau cookie-uri de sesiune. Înainte de deploy se face un checkpoint SQLite privat numai pentru sandbox, într-un director nou. Migrațiile Marketing sunt aditive. LIVE se verifică numai în citire și nu se modifică.
