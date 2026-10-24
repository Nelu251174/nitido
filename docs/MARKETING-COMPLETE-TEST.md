> Această etapă de simulare a fost extinsă prin [finalizarea colectării și procesării campaniilor](MARKETING-FINALIZATION.md). Limitele de mai jos descriu versiunea 34fd27d, nu implementarea nouă.

# Marketing — flux complet în mediul de test

Continuarea modifică exclusiv Marketing. Baza este versiunea sandbox verificată `62981fa3eed67f0ed6d7bed2e49a35ca6dbefbd1`; `main` este vechi. Autentificarea și recuperarea ADMIN, rezervările, plățile, notificările și restul aplicației nu sunt modificate.

## Acces și secțiuni

**ADMIN → Marketing**, la `https://sandbox.nitido.ro/admin/marketing`. Pagina și toate API-urile cer permisiunea existentă `super_admin`. Modulul rămâne dezactivat pe originea LIVE. Cererile de modificare cer originea ADMIN validă și au rate limiting.

1. **Panou general:** contacte eligibile, campanii, simulări, zero emailuri trimise real și istoricul colectărilor.
2. **Contacte:** cele trei categorii existente; adăugare, editarea completă a identității/datei de proveniență/acordului, filtre, paginare, export CSV și selecție/verificare în masă. Contactele „Nu contacta” nu se reactivează în masă. Erorile de versiune sau acord anulează întregul lot.
3. **Colectare firme:** CSV și verificarea CUI-urilor cunoscute prin ANAF, cu previzualizare înainte de salvare, deduplicare și istoric cu intrări, salvate, duplicate și excluse. ANAF nu caută toate firmele unui oraș și nu furnizează emailuri; categoria este selectată de administrator.
4. **Campanii:** creare/editare ciorne, categorie/localitate destinatari, subiect, mesaj, buton HTTPS, buget, previzualizare HTML sigură și descărcare HTML, pregătire, pauză, reluare, arhivare și simulare completă.
5. **Rezultate:** rapoarte de simulare cu eligibili, excluși și costul estimat, păstrate după restart. Simulările sunt etichetate explicit și nu sunt livrări, deschideri, clicuri, înscrieri sau venituri reale.
6. **Setări:** numele/emailul expeditorului, răspunsurile, adresa poștală, limita de contacte per simulare, costul estimat per email și bugetul lunar planificat. Aceste setări nu activează trimiterea și nu schimbă serviciul tranzacțional de email al aplicației.

## Traseu de utilizare

Colectează/importă contacte → verifică datele și dovada acordului → marchează contactele Verificate → completează Setări → creează și previzualizează campania → rezolvă blocajele raportate → Pregătește campania → Rulează simularea → verifică Rezultate.

O persoană fizică nouă cere dovada acordului. Pentru eligibilitatea unei campanii, toate categoriile cer email, acord documentat și starea Verificat. Lipsa emailului, lipsa acordului, neverificarea și emailurile duplicate sunt raportate separat. Un email suprimat în oricare dintre categorii este exclus global. Retragerea acordului după pregătire este reverificată la simulare; nu poate fi eludată printr-o previzualizare veche.

Modificarea conținutului readuce campania în Ciornă. Simularea reface selecția și verificările de limită/buget în tranzacția finală. Cererile repetate cu același identificator și aceeași versiune returnează raportul existent, fără dublare. Raportul păstrează conținutul, versiunea setărilor și motivele excluderilor folosite atunci. Auditul, simularea și actualizarea versiunii campaniei sunt atomice.

Costurile sunt estimări introduse de administrator, nu tarife confirmate de un furnizor. Fără o valoare configurată se afișează „Cost neconfigurat”; nu se inventează un preț. Bugetele sunt verificate pentru rularea planificată; nu există cheltuieli reale de dedus, deoarece livrarea este oprită.

## Date și limite

Schema adaugă numai tabele Marketing: `marketing_settings`, `marketing_campaigns`, `marketing_simulations`, `marketing_collection_runs`, pe lângă `marketing_contacts` existent. Nu schimbă tabelele sau secretele de autentificare. Exportul contacte este limitat la 5.000 de rezultate; lotul CSV și selecția în masă la 200 de contacte; ANAF la 20 de CUI-uri. O selecție de campanie poate avea maximum 5.000 de contacte, cu limită de simulare configurabilă între 1 și 5.000. Lista afișează ultimele 200 de campanii și 100 de rapoarte/loturi, fără ștergerea istoricului din bază.

**Trimiterea reală rămâne oprită.** Nu există importuri/apeluri către transportul de email sau coada de notificări în fluxul de simulare și nu se poate activa trimiterea prin Setări sau un payload API. Nu există programări de email instalate, tracking activ sau statistici reale fabricate. Activarea trimiterii reale/publicarea LIVE reprezintă o etapă separată, în afara autorizării curente.

## Verificare și implementare

40 de teste Marketing acoperă accesul exclusiv ADMIN, izolarea LIVE, originea cererilor, validarea datelor/HTML/URL, editarea și verificarea în masă, deduplicarea, acordurile și suprimarea globală, filtrele, bugetele, concurența, pauza/arhivarea, idempotenta simulării, istoricul și rollbackul auditului. Verificările ESLint, TypeScript și build Next.js trec.

Testul Chromium folosește un ADMIN și contacte sintetice, cu orice apel extern blocat. Verifică toate cele șase secțiuni, importul fără scriere la previzualizare, salvarea lotului și istoricul, verificarea în masă, editarea/filtrele/exportul, setările, HTML sigur, campania și eligibilitatea, două simulări, pauza/reluarea/arhivarea, excluderea unui acord retras, afișarea pe mobil și persistența după restart. Rularea a produs zero apeluri externe și zero emailuri reale. Dovezile locale sunt în `/workspace/nitido-marketing-complete-evidence`.

Deploymentul vizează exclusiv aplicația sandbox `civaeb8joydtchvzlen6pivq`, după checkpoint SQLite. Datele și autentificarea existente se păstrează. LIVE este doar citit pentru comparația sursei înainte/după. Verificarea remote nu extrage credențiale și nu creează contacte/campanii în numele beneficiarului; fluxul autentificat este probat separat în mediul local izolat.
