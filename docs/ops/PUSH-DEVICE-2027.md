# Push, telefoane și pilot 2027 — execuție

Ordinea mandatului: (1) configurare și recepție push Android/iPhone, (2) flux complet pe telefoane, (3) pilot cu firme și capacitate reală. Contul indicat de beneficiar pentru test este `support@nitido.ro`.

## Situația actuală — 23 octombrie 2026, FCM și APNs instalate

Această secțiune înlocuiește stările de blocaj din cronologia de mai jos.

- Firebase este activ în proiectul existent `nitido-508720`. CLI-ul oficial a identificat aplicația Android `ro.nitido.app` și a obținut configurația corectă, fără descărcare manuală de către beneficiar. Sursa securizată GitHub este `FIREBASE_SERVICE_ACCOUNT_JSON`; absența secretelor individuale sau a `GOOGLE_SERVICES_JSON` nu mai înseamnă lipsa configurării pentru build.
- FCM este configurat pe serverele LIVE și sandbox, numai la rulare, cu valorile protejate. După restart, autentificarea Google și cererea FCM `validate_only` au reușit din ambele servere (13:53 și 13:57 UTC). Nu s-a trimis un mesaj către telefon. `PUSH_ENABLED=false` în ambele medii până la configurarea și verificarea pe dispozitive.
- LIVE și sandbox rulează `0e7796447555737acccc4c1400fc43d120934ac4`, cu corecțiile de tokenuri și readiness. Checkpointurile DB/upload de dinaintea publicării au trecut verificarea integrității și restaurarea izolată. După restart, health/login răspund 200, iar statusul push respinge accesul neautentificat cu 401 și fără cache.
- Pachetul Android semnat candidat **1.0.3 (26)** s-a construit la sursa `698c311321fe4d081249f249174c9801fc8e6e3c`: [run 39965743634](https://github.com/Nelu251174/nitido/actions/runs/39965743634). Toate cele 547 de intrări semnate au fost verificate cu certificatul de upload existent; verificările API36 și APK16KB au trecut. Inspecția artefactului confirmă ținta LIVE și resursele Firebase pentru aplicația exactă. Pachetul nu este publicat în Play; codul 26 trebuie comparat cu maximul actual din magazin înainte de upload.
- Testele push/interfață și de configurare Firebase au trecut în [run 39965743420](https://github.com/Nelu251174/nitido/actions/runs/39965743420). Compilarea iPhone fără semnare/publicare a trecut în [run 39965752307](https://github.com/Nelu251174/nitido/actions/runs/39965752307).
- iPhone: cheia APNs existentă, pentru echipa Apple verificată, este instalată pe LIVE și sandbox. După restart, ambele servere au trecut verificarea cheii P-256, semnarea/verificarea locală a semnăturii și conexiunea TLS/HTTP2 la `api.push.apple.com`. Se folosește APNs production și bundle ID `ro.nitido.app`.
- După înregistrarea iPhone-ului de către beneficiar, LIVE a trimis o singură notificare cerută explicit către dispozitivul iOS activ al contului CLIENT `support@nitido.ro`. La 23 octombrie, 19:53 Europe/Bucharest, Apple a acceptat cererea cu HTTP 200 și identificator de mesaj. Beneficiarul a confirmat că notificarea a apărut pe iPhone și a cerut schimbarea sunetului actual. Dovada și protecția împotriva retrimiterii sunt în `/app/data/release-checkpoints/20261023-support-ios-config-test.json` pe server. Coada generală nu a fost procesată, alte conturi nu au fost vizate, jobul temporar a fost șters. Probele distincte de prim-plan/fundal/aplicație închisă, atingere și logout nu sunt încă confirmate; proba unică reușită nu le înlocuiește.
- Beneficiarul a ales sunetul standard al iPhone-ului. Payloadul APNs folosește `aps.sound="default"`, fără volum forțat sau critical alerts. Nu este necesară publicarea unui nou build iOS pentru această alegere; sunetul cerut se transmite în payload. Proba separată pentru noul sunet este limitată la același cont și protejată împotriva retrimiterii.
- Beneficiarul a aprobat explicit transferul criptat temporar. [Run 39985618675](https://github.com/Nelu251174/nitido/actions/runs/39985618675) a produs numai pachetul criptat pentru destinatarul temporar, cu retenție de o zi. Cheia a fost normalizată, validată și instalată numai în mediile NÍTIDO autorizate; valorile nu au fost afișate și nu s-a salvat cheia APNs în clar pe disc local. Cheia privată a destinatarului temporar și joburile temporare de verificare au fost șterse. Workflowul de transfer este dezactivat după operațiunea aprobată, pentru a evita repetarea exportului.
- Robotul GitHub care încearcă instalarea directă primește încă 401 de la Coolify. Acest acces este separat de configurarea runtime reușită prin transferul aprobat; nu mai este un blocaj pentru instalarea APNs încheiată.
- Publicarea Android necesită în continuare identitatea autorizată Google Play și verificarea curentă a magazinului. Nicio versiune nativă nouă nu a fost încă încărcată. Recepția Android, variantele de test iPhone rămase, fluxul complet cu Stripe TEST și pilotul cu firme rămân NETESTATE/NEACTIVATE.

## Situația confirmată la început

Pe LIVE nu există bindinguri pentru `PUSH_ENABLED`, `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_PRIVATE_KEY`, `APNS_BUNDLE_ID` sau `APNS_USE_SANDBOX`. Prezența credențialelor de publicare Apple în GitHub nu înseamnă acces APNs. Cheia Google Play este, de asemenea, diferită de Firebase/FCM.

Integrarea oficială Firebase a fost identificată ca disponibilă, dar conexiunea nu este confirmată. Aceasta permite verificarea proiectului Android existent și configurarea FCM fără a trimite chei în conversație. Nu se creează un proiect alternativ și nu se schimbă identitatea `ro.nitido.app`.

## Corecții pregătite

- Android: un build pentru magazin refuză absența sau identitatea greșită a `google-services.json`. Workflowurile pregătesc fișierul din `GOOGLE_SERVICES_JSON` sau îl obțin automat prin CLI-ul oficial folosind `FIREBASE_SERVICE_ACCOUNT_JSON`, îl validează și nu îi publică API key-urile.
- APNs: mediul development/production trebuie ales explicit; aplicațiile App Store/TestFlight folosesc production. Validarea precedă deschiderea conexiunii. Erorile de configurare nu revocă dispozitivele; erorile de stream sunt închise controlat.
- FCM: un proiect inexistent sau un payload respins nu este echivalat cu un token de telefon expirat. Se cere un identificator de mesaj confirmat înainte de marcarea acceptării de către provider.
- Starea de activare este calculată separat pentru Android și iPhone; endpointul este privat, fără cache, și nu returnează tokenuri.
- Jobul GitHub de readiness raportează numai existența bindingurilor. Verificarea Apple citește versiunea oficială prin accesul existent, fără publicare. Nu trimite notificări.

## Proba fizică

Se trimite numai către dispozitivele contului de test autorizat, niciodată către coada generală. Pentru fiecare platformă se înregistrează versiunea aplicației, modelul/OS-ul, mediul APNs, ora și identificatorul mesajului de test. Acceptarea FCM/APNs nu dovedește recepția pe ecran.

Se confirmă separat: prim-plan, fundal, aplicație închisă când OS-ul permite, atingerea notificării și destinația corectă, permisiune refuzată/reluată, ieșire din cont fără notificări ulterioare. Volumul și modul silențios rămân controlate de telefon.

## Flux pe telefon

Cu conturi de test și plăți Stripe TEST: autentificare → rezervare și preț → acceptare de către firma eligibilă → programare/reminder → supliment separat → sosire/dovezi → finalizare validă/capturare TEST → evaluare unică. Se verifică izolarea rolurilor, refuzul duplicatelor și revenirea după lipsa rețelei. Nu se fac plăți reale sau modificări la rezervările utilizatorilor pentru demonstrație. Un test în browser la dimensiune de telefon nu închide această probă nativă.

## Pilot cu firme

Se folosește un oraș cu furnizori verificați și disponibilități confirmate. Pentru fiecare firmă se consemnează acoperirea, tipurile de servicii, ferestrele martie–august 2027, durata/deplasarea și numărul de lucrări pe care firma declară că le poate prelua. Firma își decide personalul; pilotul nu schimbă formula de preț pentru client.

Intervalele se verifică în planificare pentru conflicte și se aprobă numai după confirmare reală. Firmele nu sunt declarate înscrise, contactate sau disponibile doar pe baza înregistrării lor în aplicație. Mesajele către firme reale și lansarea comercială se documentează separat, cu destinatari și mandat explicit.

## Regula de acceptanță

Configurat ≠ provider acceptat ≠ telefon confirmat. Cele trei rezultate sunt păstrate separat. Zonele fără configurare ori dispozitiv rămân BLOCATE/NETESTATE, fără marcaj VERDE fabricat.

## Dovezi actualizate — 22 octombrie 2026, UTC

- Contul support@nitido.ro există: verificare numai în citire reușită la 20:32:07.
- Niciun dispozitiv Android sau iPhone activ nu a îndeplinit verificarea de înregistrare pentru acest cont la 20:33:13. Nu au fost citite sau afișate tokenuri.
- Există firme verificate. Verificarea intervalelor active aprobate și a echipelor active pentru martie–august 2027 nu a trecut; nu se declară disponibilitate reală confirmată.
- 65 de teste push/interfață și 3 teste ale configurației Firebase au trecut local. Buildul web, TypeScript și lintul au trecut. Testele providerilor folosesc simulări; recepția fizică rămâne NETESTATĂ.
- GitHub Actions nu a pornit joburile: «The job was not started because your account is locked due to a billing issue.» Dovadă: https://github.com/Nelu251174/nitido/actions/runs/39849441149 . Din acest motiv, prezența credențialelor în GitHub și starea actuală Apple nu au putut fi reverificate prin joburile pregătite.
- Nu s-a schimbat configurația push LIVE, nu s-a trimis un nou build în magazine și nu s-au trimis notificări de demonstrație utilizatorilor. Corecțiile sunt în PR-ul 135; publicarea se face după verificarea candidatului.

## Reluare — 23 octombrie 2026, Europe/Bucharest

Verificare din mediul cloud reluat (22 octombrie, aproximativ 22:10 UTC), prin proxy-ul configurat și cu verificarea TLS activă:

| Destinație | Răspuns HTTPS fără autentificare | Interpretare |
|---|---|---|
| `https://auth.firebase.tools/` | 302 | Serviciul de conectare este accesibil |
| `https://accounts.google.com/` | 302 | Serviciul Google de autentificare este accesibil |
| `https://oauth2.googleapis.com/token` | 404 pentru GET fără parametri | Domeniul răspunde; schimbul OAuth nu a fost verificat |
| `https://firebase.googleapis.com/v1beta1/projects` | 401 | API-ul răspunde și cere autentificare |

Prima încercare, fără acces de rețea acordat comenzii, nu a putut conecta proxy-ul. Aceeași verificare a reușit după acordarea accesului de rețea comenzii, păstrând proxy-ul și politica de destinații. Răspunsurile de mai sus confirmă accesul HTTPS, nu drepturile asupra proiectului.

Node.js `24.19.0` și Firebase CLI `15.34.1` sunt disponibile. CLI-ul oficial a generat conectarea fără localhost. Finalizarea așteaptă autentificarea beneficiarului cu un cont Google care are acces la proiectul Firebase existent și codul de autorizare emis de Firebase. `support@nitido.ro` este contul aplicației pentru proba fizică; nu se presupune că este și administrator Firebase. Linkul temporar, codul de autorizare și credențialele CLI nu se salvează în Git.

Pluginul Firebase are instrucțiuni disponibile, dar catalogul de unelte al acestei sesiuni nu expune un server Firebase MCP. Generarea linkului prin CLI nu confirmă o conexiune a pluginului. Nu a fost creat sau selectat un proiect alternativ și identitatea `ro.nitido.app` este păstrată.

După autentificare: se identifică proiectul existent și aplicația Android exactă, se obține și se validează configurația Firebase prin canal securizat, apoi se verifică separat FCM și APNs. Pentru fiecare telefon se completează dovezile din «Proba fizică» înainte de închiderea probei native. Fluxul comercial folosește numai Stripe TEST; pilotul martie–august 2027 așteaptă confirmarea firmelor și verificarea capacității reale.

Starea acestei reluări: **rețea verificată; conectare generată, autentificare în așteptare; recepție Android/iPhone NETESTATĂ; pilot NEACTIVAT**. Constatările LIVE și blocajul GitHub Actions din secțiunea precedentă sunt dovezi istorice și nu au fost reverificate în această reluare.

### Verificarea accesului și a bindingurilor după primul răspuns OAuth

- Autentificarea CLI a reușit, dar `projects:list --json` a întors succes cu lista goală. Acest rezultat înseamnă că primul cont conectat nu vede proiecte Firebase; nu dovedește inexistența proiectului NÍTIDO. Nu s-a creat un proiect nou.
- Sesiunea inițială a fost deconectată, iar revocarea OAuth a fost confirmată cu HTTP 200. A fost generată o conectare nouă pentru contul administrator indicat ulterior de beneficiar. Codurile și tokenurile nu se includ în acest document.
- API-ul Coolify a fost consultat numai în citire pentru aplicațiile LIVE și sandbox. Ambele raportează `running:healthy`. Lipsesc bindingurile `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `GOOGLE_SERVICES_JSON`, `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_PRIVATE_KEY`, `APNS_BUNDLE_ID` și `APNS_USE_SANDBOX` în ambele aplicații. LIVE nu are binding `PUSH_ENABLED`; în sandbox cheia există, dar prezența ei singură nu dovedește activarea push. Nu se afișează valori de secrete.
- Nu s-a modificat configurația Coolify, nu s-a făcut deployment și nu s-au trimis notificări. Înregistrarea dispozitivelor și capacitatea firmelor pentru pilot nu au fost reverificate în această etapă.

La această etapă, dependența era finalizarea conectării cu administratorul proiectului existent. Recepția pe ambele telefoane rămâne NETESTATĂ, iar pilotul rămâne NEACTIVAT.

### Proiectul existent identificat după reconectare

- Reconectarea CLI cu contul indicat de beneficiar a reușit. `projects:list` a întors din nou succes cu o listă goală de proiecte Firebase.
- Verificarea numai în citire a proiectelor Google Cloud disponibile pentru adăugarea Firebase, prin biblioteca CLI oficială, a identificat proiectul existent **NITIDO**, ID **`nitido-508720`**. Firebase nu este încă activat în acest proiect; autentificarea funcțională și lista Firebase goală nu sunt contradictorii.
- Următorul pas concret este `npx -y firebase-tools@latest projects:addfirebase nitido-508720 --non-interactive`, urmat de verificarea/înregistrarea aplicației Android cu package `ro.nitido.app` și obținerea configurației prin CLI. Se păstrează proiectul Google Cloud existent.
- Activarea nu a fost executată: verificarea automată de aprobare a respins comanda, deoarece activarea modifică proiectul cloud și poate avea efecte asupra configurației/facturării; a cerut aprobarea explicită a beneficiarului. Aceasta este o oprire înainte de execuție, nu o eroare returnată de Firebase.
- Starea la acel moment: **autentificare CLI CONFIRMATĂ; proiect existent IDENTIFICAT; activare Firebase ÎN AȘTEPTAREA APROBĂRII; FCM/APNs neconfigurate; recepție fizică NETESTATĂ; pilot NEACTIVAT**. Configurația LIVE nu a fost modificată.

### Activare aprobată — blocaj de rețea la reînnoirea sesiunii

- Beneficiarul a aprobat explicit activarea Firebase în proiectul existent `nitido-508720`. Aprobarea rămâne valabilă pentru reluare; nu se solicită din nou.
- Comanda CLI de activare a pornit, dar s-a oprit în autentificare, înaintea cererii de activare. CLI-ul reînnoiește sesiunea la `https://www.googleapis.com/oauth2/v3/token`; verificarea anterioară a celor patru domenii nu acoperea acest domeniu suplimentar.
- Cererea HTTPS de diagnostic către `www.googleapis.com` a primit `CONNECT tunnel failed, response 403`. Domeniul lipsește din lista permisă a mediului cloud. Acest refuz al proxy-ului explică eșecul reînnoirii; mesajul generic al CLI despre credențiale invalide nu stabilește că accesul contului a fost revocat.
- Remediere necesară: adăugarea domeniului exact `www.googleapis.com` în lista de domenii permise a mediului, prin configurația suportată. Uneltele disponibile aici permit citirea stării mediului, fără modificarea acelei configurații. Se păstrează proxy-ul și verificarea TLS.
- După remediere se reia autentificarea prin CLI și activarea în același proiect, apoi înregistrarea/verificarea aplicației Android și descărcarea configurației. Nu s-a creat configurația Android, nu s-au activat bindinguri pe LIVE și nu s-au trimis notificări.

Starea la acel moment: **activare Firebase APROBATĂ, BLOCATĂ de accesul la endpointul de reînnoire OAuth; FCM/APNs neconfigurate; recepție fizică NETESTATĂ; pilot NEACTIVAT**.

### Variantă OAuth funcțională — refuz de autorizare la activarea proiectului

- Sesiunea existentă a fost reînnoită cu succes prin biblioteca oficială Google `google-auth-library`, folosind endpointul său implicit `https://oauth2.googleapis.com/token`, deja permis în mediu. Nu s-a contactat domeniul blocat, nu s-a schimbat proxy-ul și nu a fost necesară o conectare nouă din partea beneficiarului.
- Au fost reutilizate credențialele sesiunii autorizate, numai în memorie și în depozitul privat al CLI-ului. Niciun token nu a fost inclus în Git sau în rezultatul acestui diagnostic.
- Verificarea oficială OAuth a confirmat identitatea contului indicat și granturile `cloud-platform` și `firebase`. Sesiunea și accesul de rețea necesar acestei cereri sunt funcționale.
- Comanda aprobată de activare a ajuns la `POST https://firebase.googleapis.com/v1beta1/projects/nitido-508720:addFirebase`. API-ul Google a răspuns cu **HTTP 403**, `PERMISSION_DENIED`, mesajul **«The caller does not have permission»**. Acesta este răspunsul providerului, distinct de refuzul anterior al proxy-ului. Răspunsul nu a identificat o permisiune IAM sau o politică precisă.
- Reverificarea numai în citire confirmă că proiectul Google Cloud **NITIDO / `nitido-508720`** este vizibil, iar proiectul nu apare în lista Firebase activată. Nu s-a creat un proiect alternativ și nu s-a schimbat identitatea aplicației.
- Activarea nu este confirmată și nu poate fi declarată realizată. Înregistrarea aplicației Android, obținerea configurației și testul FCM așteaptă rezolvarea autorizării pentru această operațiune. APNs necesită separat credențialele Apple prevăzute mai sus.

Starea curentă: **reînnoire OAuth REZOLVATĂ prin endpoint oficial deja permis; activare Firebase APROBATĂ, REFUZATĂ de Google cu `PERMISSION_DENIED`; FCM/APNs neconfigurate; recepție fizică NETESTATĂ; pilot NEACTIVAT**. Nu s-a modificat configurația LIVE și nu s-au trimis notificări.

## Alternative investigate la cererea beneficiarului

Analiza verificată și pachetul propus sunt în [PUSH-ALTERNATIVES-20261023.md](PUSH-ALTERNATIVES-20261023.md): Web Push în PWA existentă, APNs direct pentru iPhone și canalele email/SMS existente. Fiecare variantă păstrează separat implementarea, configurația și proba fizică. Recomandarea Web Push cere implementare și acceptanță separată pentru versiunea web instalată; nu închide testele aplicațiilor native din magazine.

## Reluare după activarea din consolă și deblocarea GitHub — 23 octombrie 2026

- Capturile transmise de beneficiar confirmă „Your Firebase project is ready” în proiectul existent `nitido-508720` și înregistrarea aplicației Android. Refuzul addFirebase din cronologia de mai sus este istoric; nu se repetă activarea și nu se creează un proiect nou. Identitatea package-ului și configurația descărcată trebuie încă validate prin API/CLI.
- Beneficiarul a confirmat plata GitHub. Reluările joburilor 39942038197 (push) și 39942038397 (compilare iPhone fără semnare/publicare) au pornit efectiv, inclusiv checkout, setup Node și npm ci. Blocarea facturării nu mai împiedică pornirea acestor joburi. Rezultatele complete se verifică separat.
- Această actualizare pornește workflowul existent de verificare numai în citire: prezența bindingurilor GitHub și versiunea oficială Apple. Nu trimite notificări și nu publică aplicații.
- Ultima citire Coolify confirmă LIVE și sandbox sănătoase la `baa0b0214dbbe5b1f76b2926cc01270a3795a1eb`, fără bindingurile FCM/APNs pe ambele. Nu se confundă absența pe server cu absența unor credențiale în GitHub.
- Mediul acestei conversații păstrează politica veche de destinații; nu are acces la Firebase/OAuth/Apple API. Nu se cere din nou autorizarea lucrării și nu se generează o nouă autentificare.
- Recepția fizică Android/iPhone, fluxul comercial de test și pilotul cu firme rămân neînchise până la dovezile specifice.
