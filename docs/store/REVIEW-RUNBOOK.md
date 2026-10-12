# Pregătirea reviewului și publicării — agent

Stare: local, netrimis. Agentul execută configurările și operațiile după conectarea conturilor existente; nu cere utilizatorului să compileze sau să completeze manual pașii de programator. Intervenția utilizatorului se limitează la autentificarea/autorizarea care nu poate fi delegată și la datele legale reale inexistente în context.

## Date care nu se inventează

Bundle/package: `ro.nitido.app`, păstrat. Numele juridic, copyrightul, contactul nominal/telefonul de review, trader status, disponibilitatea teritorială, vârsta, numărul/versionCode final și conturile de test sunt încă necunoscute. Existența unui succes istoric GitHub/TestFlight nu dovedește o sesiune actuală App Store Connect/Play Console sau un release public. Materialele se completează numai din conturile și buildul efectiv verificate.

Agentul pregătește utilizatori dedicați reviewului cu date sintetice și roluri minime, prin mecanismele normale de cont, fără a copia sesiuni reale sau a dezactiva MFA/originea/permisiunile. Credencialele se livrează doar în câmpurile securizate ale consolei după testarea autentificării; nu apar în Git sau acest document. Nu este creat vreun cont prin simpla redactare a acestui runbook.

## Text de bază pentru review notes

NITIDO organizează servicii fizice de curățenie pentru clienți și firme în România. Clientul configurează solicitarea, consultă costul și urmărește rezervarea; în Standard alege firma dintre ofertele disponibile, iar Express depinde de disponibilitatea eligibilă. Firma verificată consultă lucrările autorizate și documentează execuția. Datele private sunt limitate pe rol și alocare. Geolocalizarea pentru completarea adresei este opțională, cu alternativă manuală.

Aplicația Capacitor folosește backendul HTTPS configurat și integrările native existente. Nu oferă un produs digital prin abonament Pro în acest release. Plata serviciului fizic păstrează integrarea Stripe existentă; reviewul nu este instructat să facă rezervări, debitări sau intervenții reale.

Înainte de trimitere, agentul completează în consolă versiunea/buildul, backendul efectiv, credencialele funcționale, datele sintetice accesibile, serviciile externe active, pașii și limitele de review. Nu trimite note cu placeholders sau funcții indisponibile. Orice mediu dedicat reviewului trebuie să fie declarat și să permită aceleași funcții relevante; nu se ascund funcții față de review.

## Parcurs care se verifică în buildul final

1. Deschidere, accesibilitate, layout și limbă pe iPhone/Android, inclusiv safe area, tastatură și revenire după background.
2. Autentificare client și firmă cu conturile dedicate; accesul angajatului numai dacă este inclus și demonstrabil în release. Rolurile administrative interne nu devin conturi publice de review.
3. Configurarea rezervării cu localizare refuzată și adresă manuală; consultarea costului fără publicarea unei lucrări reale.
4. Consultarea unei rezervări sintetice existente, stări, comunicare, fotografii autorizate și evaluare; controlul datelor altui cont.
5. Firmă: feed autorizat, calendar și dovezi sintetice. Nu se iau lucrări reale pentru probă.
6. Permisiuni notificări/cameră/locație: acceptare și refuz, revenire din Settings, logout și revocarea tokenului. Push-ul efectiv cu sunet cere probă dispozitiv/provider; pluginul instalat nu o înlocuiește.
7. Inițierea ștergerii contului sintetic din profil și resursa web dedicată; mesajul privind retenția și confirmarea. Se verifică fluxul fără a șterge date reale. Candidatul are `/stergere-cont` și jurnal requested/under_review; îndeplinirea, termenul comunicat, confirmarea finală și rezultatul sunt încă deschise și blochează declararea conformității pentru publicare. O cerere înregistrată nu este declarată drept ștergere finalizată.
8. Suport și privacy URL în build și în browser extern, cu identificare/contact reale, plus scenariile de rețea indisponibilă.

## Trimitere și status

Agentul selectează artefactul cu identitatea/semnarea existente, verifică cerințele din `OFFICIAL-SUBMISSION-REQUIREMENTS.md`, completează declarațiile din inventarul real și încarcă materialele mobile autentice. Publicarea se efectuează în conturile existente după probe, cu autorizarea deja acordată; nu se creează conturi cu taxe noi fără acord separat.

Se consemnează distinct: build produs, semnat, încărcat, procesat, distribuit test, trimis review, aprobat, publicat. Fiecare stare cere dovadă curentă din consolă sau API. „Upload succeeded” nu înseamnă disponibil în magazin; nici un release intern nu este numit production public.

Nu au fost trimise App Review/Google review sau realizate publicări prin acest pachet de documente. Accesul consolelor, configurația providerilor, backendul LIVE și probele dispozitivelor sunt limite efective încă de verificat.

## Istoric tehnic recuperat, separat de accesul curent

Auditul GitHub Actions a găsit iOS Capacitor #12 și Android signed #18 din 24 septembrie 2026, pe `f79a8fad40491fe7eba484a81fae8446fe6e3d1c`. Agentul de infrastructură a confirmat istoric un IPA semnat și upload TestFlight reușit. Android a produs AAB semnat, însă uploadul Google Play a fost sărit deoarece contul de serviciu lipsea. Aceste rezultate nu sunt un release nou al candidatului, nu dovedesc acces actual la console și nu sunt publicare App Store/Google Play. Sursa de dovezi și logurile actuale sunt consemnate în documentația mobilă de infrastructură.

Ținta canonică rămâne aplicația **Capacitor existentă**, cu identitatea/semnarea păstrate. Proiectul Expo este auditat separat și nu înlocuiește automat aplicația instalată sau artefactele de review.
