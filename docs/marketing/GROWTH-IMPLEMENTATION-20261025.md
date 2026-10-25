# Marketing: clienți, firme partenere și persoane fizice

Cerința utilizatorului este implementarea efectivă a extinderii Marketing, cu emailurile oprite. Autentificarea, rezervarea și celelalte module nu se modifică. Colectarea CT/B continuă, iar BV → IF → CJ → IS → TM rămân în coadă conform planului existent.

## Implementare

- Campaniile au județ distinct de localitate. Se selectează toate apartenențele unui contact în județul ales, inclusiv sedii în mai multe județe. București și Ilfov rămân separate. Selecția nu mai este trunchiată la 5.000; lotul de rulare este o limită explicită, iar restul audienței apare separat.
- Variantele A/B folosesc o împărțire stabilă după hashul emailului, astfel încât aceeași adresă să nu apară în ambele variante. Ciornele folosesc același mesaj, cu subiecte diferite, și nu schimbă singure setările expeditorului sau ale bugetului.
- Pregătirea ciornelor produce șase campanii per județ din plan: trei audiențe × două subiecte. Acțiunea este idempotentă și păstrează modificările administratorului. Toate rămân `draft`; nu sunt create rulări sau mesaje în outbox.
- Formular public separat: `/marketing/inscriere`. Permite alegerea interesului (locuință, firmă, firmă de curățenie), județului și localității și cere acord explicit nebifat implicit. Nu importă utilizatorii sau rezervările existente și nu colectează emailurile private ale particularilor de pe internet.
- Solicitările intră în `marketing_signups` ca `pending`, cu versiunea/textul acordului, data și sursa. Publicul primește același răspuns pentru înscrieri noi/duplicate; nu primește ID, email sau token. Originea, dimensiunea cererii și frecvența sunt verificate; există honeypot.
- Tokenurile de confirmare sunt aleatoare și păstrate numai ca hash, cu expirare. Pregătirea lor internă este blocată cât timp expedierea este oprită. Confirmarea publică cere acțiune explicită și nu expune identitatea contactului în răspuns. Nu există trimitere automată a confirmărilor în această etapă.
- Confirmarea validă creează/actualizează numai dovada explicită pentru contactul înscris. Nu marchează contactul automat `reviewed` și nu reactivează dezabonări sau reclamații. Contactele protejate rămân excluse și necesită fluxul explicit de revizuire existent.
- Eligibilitatea campaniilor cere acord documentat, revizuire, email verificat tehnic și lipsa suprimării. Aceste condiții, județul și varianta sunt reverificate înainte de procesarea unei livrări. Verificarea tehnică utilizează DNS/MX, fără SMTP.
- Verificările emailurilor confirmate/importate cu acord și revizuire folosesc colectorul exclusiv existent. Nu se acordă consimțământ contactelor publice doar pentru că au fost colectate. Solicitările neconfirmate expirate sunt șterse după 30 de zile; nu sunt șterse contactele sau dovezile confirmate.
- Panoul Market → Înscrieri afișează filtre pe județ, audiență și stare, dovezi, retragerea unei înscrieri și linkul public de distribuit. Nu afișează tokenuri. API-ul administrativ păstrează autorizarea `super_admin` existentă.
- Textele formularului și confirmării au fost adăugate numai ca mesaje Marketing în cele nouă limbi deja publicate. Restul traducerilor și modulelor rămân neschimbate.

## Expediere și promovare

Expedierea rămâne oprită, inclusiv confirmările. Solicitările reale pot fi înregistrate, dar rămân neconfirmate și neeligibile până la confirmare și revizuire. Nu sunt create conturi de client/furnizor prin formularul Marketing. Înscrierea firmei în platformă rămâne în fluxul existent, accesibil prin linkul său public.

Sunt pregătite texte și linkuri distribuibile; nu sunt lansate reclame plătite sau mesaje în canale externe. Bugetul, disponibilitatea reală a firmelor și autorizarea expedierii rămân condiții distincte ale lansării.

## Verificare

Verificare și publicare la 25.10.2026:

- 191 teste Marketing trecute; un test de fum extern omis fără configurare. TypeScript, ESLint și toate verificările i18n au trecut. Buildurile de producție în Coolify au trecut.
- Sandbox `680deb38ea29037f87034f0798ca88df0172d0d4`, sănătos. LIVE `07af7df1146ff34e5734a74140b03dd0f5dac47d`, sănătos, deploy finalizat. Au fost transferate selectiv numai schimbările Marketing; autentificarea fiecărui mediu a fost păstrată.
- În fiecare mediu au fost create 42 de ciorne: șase pentru fiecare CT, B, BV, IF, CJ, IS, TM. Starea este `draft`; pilotul este 50, fără plafon total al bazei. Nicio campanie nu a fost activată.
- Chromium la 390 px: formular 200, fără depășire orizontală sau erori JavaScript, acord nebifat, preselectare CT/persoane fizice. Formularul real sandbox a răspuns 202 cu numai `received:true`; solicitarea a rămas pending, fără contact sau token creat, apoi fixture-ul exact a fost șters. Nu au fost introduse solicitări de test pe LIVE.
- Cerere cu altă origine: 403; API administrativ fără sesiune: 401/JSON. LIVE: formular și confirmare 200; corp invalid 400/JSON. Testul browserului a folosit proxy-ul și conexiuni validate TLS prin configurația Node existentă, fără modificarea listei permanente de certificate.

## Remedierea catalogului București

Diagnosticul read-only a identificat etichete goale în unele ancore ale catalogului, cu metadate și URL-uri prezente. Parserul acceptă acum eticheta goală numai dacă județul și URL-ul profilului sunt valide. Numele real rămâne obligatoriu în profil; nu este inventat și nu este împrumutat de la firma următoare. Testul de regresie păstrează separarea București/Ilfov și respinge profilurile fără identitate.

Reluarea îngustă a paginii blocate a păstrat pauzele sursei, inventarul și lucrătorul unic. În sandbox, listele procesate au crescut de la 13 la 33, fără surse blocate, iar firmele procesate de la 10.688 la 10.736. Aceeași remediere testată a fost publicată pe LIVE și CT/B au fost reluate. Niciun județ nu este declarat finalizat.


## Stare LIVE confirmată după reluare

Constanța: `collecting`, 5.588/5.590 firme procesate, 1.570 emailuri cu sursă și MX verificate; catalogul are 1.530 pagini procesate, fără pagini blocate. București: `collecting`, 10.837/14.001 firme procesate, 272 emailuri cu sursă și MX verificate; listele catalogului au avansat 13 → 23, fără pagini blocate. Aceste cifre sunt un instantaneu, nu o declarație de finalizare sau de existență garantată a căsuțelor.

În LIVE există 42 de campanii, toate `draft`, câte șase per județ din plan. Nu există înscrieri PF fabricate, tokenuri de confirmare sau mesaje în outbox; livrarea este blocată. Cele cinci județe viitoare rămân `queued`, cu zero inventar importat. Colectorul existent continuă CT/B; monitorizarea periodică a conversației nu a fost repornită. Sarcinile temporare din ambele medii au fost șterse și absența lor verificată.
