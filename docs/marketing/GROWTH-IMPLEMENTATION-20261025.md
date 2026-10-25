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

Rezultatele finale ale testelor, publicarea în sandbox/LIVE, verificarea formularului și numărul ciornelor se consemnează după execuție. Nu reprezintă o declarație că întreg județul Constanța sau București este finalizat.
