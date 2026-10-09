# E5 — Prima livrare pentru pregătirea lansării

Etapa următoare din brief-ul master, secțiunea 18, este E5: migrare, restaurare, SEO, suport, performanță și monitorizare. Owner a autorizat continuarea execuției; această livrare rămâne în sandbox.

## Implementat

- Indexare închisă implicit. `SITE_PUBLIC_INDEXING=true` este necesar împreună cu `NEXT_PUBLIC_SITE_URL` pe HTTPS și hostname exact nitido.ro sau www.nitido.ro pentru a permite indexarea publică. Sandboxul nu trebuie să primească acest flag.
- Proxy Next.js adaugă X-Robots-Tag noindex/nofollow/noarchive pe toate paginile sandbox și pe rutele private. Hostul cererii trebuie să fie exact unul dintre domeniile publice pentru a permite indexarea; nu se folosesc header-ele forwarded pentru această decizie. Nu se modifică autentificarea sau redirecturile.
- robots.txt și sitemap.xml sunt generate din configurația runtime. În mediu nepublic: Disallow / și sitemap gol. Domeniile publice aprobate păstrează sitemapul și exclud rutele de cont.
- Aceste directive SEO nu reprezintă control de acces și nu șterg imediat eventuale URL-uri deja indexate. Conținutul privat rămâne protejat de autentificarea existentă.
- `/api/health` dinamic și no-store: confirmă lectura bazei SQLite, prezența structurii rapoartelor/modulelor și permisiunile de citire/scriere pe directoarele data și public/uploads. Nu creează fișiere și nu modifică înregistrări. Nu raportează spațiul liber sau succesul unui backup.
- Răspuns public minimal: status ok / unavailable, HTTP 200 / 503. Fără erori SQL, nume de conturi, chei sau configurări.
- Healthcheck-ul existent Coolify folosește noul endpoint local, cu timeout de 3 secunde, fără redirecturi și fără credențiale. Fixtures pentru testul existent au fost adaptate noului contract; testele nu au fost executate, conform instrucțiunii Owner.

## Verificări pentru această livrare

TypeScript, ESLint, compilare Next.js și healthcheck la instalare. Nu se repetă fluxurile funcționale sau plățile. Nu se creează date de probă, plăți, conturi ori rapoarte.

## Ce rămâne distinct în E5

- Dovadă actuală pentru backup/restaurare, inclusiv cheia iCal din data/ical-url.key și fotografiile; istoricul probelor anterioare nu certifică automat candidatul nou.
- Configurarea canalului de alertare externă la indisponibilitatea serverului. Endpointul și healthcheck-ul local nu trimit singure alerte către Owner și nu garantează recuperare automată.
- Bilanț performanță, accesibilitate, suport și cerințe rămase, fără a transforma compilarea într-o acceptare funcțională.
- Acceptare finală și publicare website în producție. Controalele financiare live rămân distincte.
- App Store / Google Play: livrare separată, fără publicare în această intervenție.

## Operare

Dacă healthcheck-ul eșuează, Coolify păstrează dovada în Deployment Logs; se verifică Runtime Logs și volumele persistente. Nu se șterg volumele, baza de date sau cheia iCal pentru a obține verde. Pentru rollback se alege commitul anterior confirmat, cu aceeași bază și aceleași volume; această schimbare nu introduce migrare de date.

Înaintea publicării aprobate se configurează domeniul public corect și SITE_PUBLIC_INDEXING=true, apoi se verifică robots.txt, sitemap.xml și headerele HTTP. Nicio activare automată a indexării la simpla instalare în sandbox.
