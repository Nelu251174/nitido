# E3 — livrare proprietăți, recurență, echipe și remedieri

Țintă: `codex/nitido-full-option-v3`, aplicația Coolify `nitido-v3-sandbox`, https://sandbox.nitido.ro. Bază instalată: `764bf05`. Nu reprezintă publicare App Store / Google Play și nu schimbă branch-ul producției.

## Autorizație și verificare

Beneficiarul a cerut finalizarea E3 și începerea E4 imediat după. A confirmat anterior funcționarea fluxurilor și a cerut explicit să nu fie repetate testele. Livrarea folosește revizuirea codului, compilarea Next.js/TypeScript și healthcheck-ul instalării. Nu sunt declarate teste noi de plată, concurență, dispozitiv sau acceptare autentificată. Confirmările istorice nu sunt prezentate drept probe ale modificărilor noi.

Compilarea finală `npm run build` s-a încheiat cu cod 0 (Next.js și TypeScript), fără executarea testelor. `git diff --check` nu a raportat erori. Rezultatul instalării va fi consemnat cu SHA-ul emis după commit.

## Funcții livrate

- Proprietățile păstrează camere, materiale sensibile, sarcini uzuale, preferințe și indicații generale de acces. La crearea unei vizite, instrucțiunile de curățenie se salvează separat de fișa editabilă. Codurile din câmpul dedicat accesului nu se copiază automat în vizitele noi; accesul se reconfirmă per lucrare.
- Reprogramare individuală și „aceasta și următoarele”, cu previzualizare și verificarea reviziei. Vizitele începute/finalizate sunt refuzate; pauzele și data de sfârșit sunt respectate. Vizitele alocate păstrează programul până la acordul firmei și rezolvarea autorizării necesare.
- Generare anticipată pe 30 de zile, configurabilă; fără recuperarea retroactivă a vizitelor trecute. Fiecare apariție are lucrare și snapshot de preț proprii. Schimbarea ritmului creează o generație de programare, fără rescrierea identității vizitelor existente.
- Pauza prezintă vizitele existente care trebuie anulate prin fluxul lor propriu; nu anulează implicit o rezervare sau o plată.
- Firma preferată se alege dintre firmele verificate cu care clientul a finalizat lucrări. Primește invitație pentru vizita generată. Clientul vede candidatura și poate selecta alternative. Preferința nu alocă automat capacitate. Confirmarea vizitelor recurente rămâne în fereastra existentă de 48h.
- Calendar zi/săptămână/lună, filtre pe echipă, serviciu și oraș; lista Azi separă confirmate, oportunități în așteptare și acțiuni necesare. Durata minimă/deplasarea echipei pot extinde ocuparea, nu scurta rezervarea. Salvările cu suprapuneri se refuză. Nu există mutare prin drag-and-drop care să ocolească reprogramarea confirmată.
- Redenumire/arhivare echipe, concedii/indisponibilități și realocare. Arhivarea cere realocarea lucrărilor active și revocă membrii/invitațiile. Realocarea și revocarea produc actualizări interne fără datele lucrării în mesajul fostului membru.
- Sesizări: acces imposibil, client absent, scop diferit, daună, calitate, sarcină nerealizabilă. Dosarul conține motiv, sarcină, fotografie validată și istoric de răspunsuri. Fotografiile suplimentare sunt private și nu țin loc de dovadă de sosire/finalizare.
- O sarcină raportată nerealizabilă nu poate fi bifată realizată cât timp dosarul este deschis. Nu se modifică retroactiv checklist-ul unui raport deja trimis.
- Firma inițială propune revenirea gratuită, clientul acceptă/refuză intervalul. Eligibilitatea, suspendarea și capacitatea firmei se reverifică la acceptare. O singură revenire per lucrare, fără autorizare sau încasare nouă. Revenirea este legată de lucrarea și proprietatea inițială.
- Clientul sau administratorul confirmă soluționarea; revenirea activă trebuie finalizată/anulată mai întâi. Clientul poate confirma explicit recepția lucrării finalizate. Lipsa răspunsului nu devine acceptare tacită.
- Preferințele pentru revenire/promoții sunt distincte de notificările tranzacționale și sunt implicit oprite. Nu a fost activată o campanie comercială.
- Toate accentele folosesc verdele brandului existent. API-urile și ecranele noi pentru firme nu expun comisionul platformei.

## Politică financiară păstrată

Recepția explicită este un registru operațional. Nu schimbă politica de capturare existentă la finalizarea firmei. Sesizarea nu constituie refund și nu modifică retroactiv sumele. Fereastra existentă de 48h determină eligibilitatea sesizării pentru revenirea gratuită. Celelalte reclamații pot fi documentate fără promisiunea unei remedieri gratuite.

Nu s-a activat propunerea din brief de mutare a capturării după recepția clientului. Aceasta ar fi o schimbare separată a politicii financiare.

## Migrări și operare

- Tabele noi: instrucțiuni per vizită, dosare, evenimente, recepții, preferințe și actualizări interne. Coloane noi pentru timpul echipelor și generația planului.
- `recurring_occurrences` se reconstruiește într-o tranzacție imediată, păstrând fiecare rând și referință de lucrare; cheia devine `(plan_id, schedule_generation, occurrence_date)`, iar `job_id` rămâne unic. Schema este reverificată sub blocare pentru porniri concurente. Copierea nereușită anulează tranzacția.
- Identitățile anterioare rămân generația zero. Reprogramarea modifică data efectivă, fără modificarea identității. Generatorul refuză un interval încă ocupat de o vizită existentă după o propunere nesoluționată.
- Coolify afișa sarcina „NITIDO recurring visits” cu `*/5 * * * *` și Success înainte de instalarea candidatului E3. Runnerul existent `scripts/recurring-runner.mjs` cheamă ruta protejată de cron; există și acțiunea explicită de generare în panoul clientului. GET nu generează lucrări.
- Vechiul POST `/api/jobs/:id/reclean` întoarce instrucțiunea de folosire a dosarului, fără alocare gratuită instantanee. Shell-ul web folosește noul flux; clienții API vechi trebuie actualizați pentru a folosi revenirea confirmată.
- Un downgrade la codul anterior după modificări de ritm necesită oprirea generatorului vechi: acesta nu cunoaște generațiile. Se păstrează schema și evidențele; nu se șterg vizite pentru rollback.

E4 începe după instalarea acestei livrări. Domeniul E4 este definit în §12 și §18 ale brief-ului; raportul de pregătire este separat de închiderea implementării E3.
