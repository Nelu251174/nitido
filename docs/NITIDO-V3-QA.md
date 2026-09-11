# NITIDO v3 — verificare integrată și corecții

Bază verificată: PR #49, pornind de la `de6fa8c`. Această etapă nu reprezintă publicarea în producție sau închiderea întregului brief.

## Probleme reproduse și corectate

| Problemă | Reproducere | Corecție |
|---|---|---|
| Control de origine ocolit prin antet Authorization arbitrar | Sesiune cookie validă + origine străină + Basic returna 200 la modificarea bugetului | Excepția de origine este permisă numai pentru autentificarea Bearer activată și validată; cookie-urile păstrează verificarea originii |
| Raport modificabil după trimitere | Checklistul putea fi schimbat prin API după raport | Verificările raportate sunt blocate, răspuns 409 |
| Ora depindea de fusul serverului | Ora 10:00 devenea 13:00 în România când serverul rula în UTC | Conversie explicită Europe/Bucharest pentru rezervări programate și ASAP; reutilizare în recurență |
| Pierderea rezervării la creare cont | În browser, linkul de înregistrare pierdea next cu tipul și suprafața | Autentificarea și înregistrarea păstrează o destinație internă validată, inclusiv invitații și aprobări |
| Imagine trunchiată acceptată ca dovadă | Semnătura PNG fără date imagine era suficientă pentru VALID | Decodare completă, eliminarea metadatelor, limită 40 MP și redimensionare maximum 2560 px; fișierul invalid nu se salvează |
| Pornire și resurse interactive în mediul de preview | Parametri incompatibili cu Next.js; resurse de dezvoltare blocate pentru originea internă | Wrapper care păstrează Next.js și traduce parametrii; allowedDevOrigins limitat la domeniul intern de preview, fără modificarea regulilor de producție |

## Dovezi de verificare

- 350 teste web/backend trecute local, în 46 fișiere; build Next.js și ESLint reușite.
- 8 teste de integrare API folosesc resolverul real de sesiuni, o bază SQLite în memorie cu schema aplicației și fișiere foto izolate. Nu folosesc datele clienților.
- Acoperire: invitație, acceptare, alocare, fotografii, sosire, checklist, raport, restricționarea finalizării la titularul firmei, revocare, realocare, buget, credit, consum unic și rollback.
- Verificări de fus orar: UTC, Europe/Bucharest și America/New_York; iarnă, vară, ambele schimbări de oră și trecerea între luni.
- Browser desktop: homepage randată, imagini încărcate, fără depășire orizontală la lățimea de 1348 px; estimatorul pentru birou 100 m² afișează 450 lei; selecția se păstrează în linkul către rezervare, apoi între login și signup în ambele direcții.
- Mesajele din ecranul de cont explică ambele moduri, Standard și Express.
- Sharp 0.35.3, deja prezent în dependențele Next.js, este declarat explicit pentru validarea uploadurilor. Configurarea intrărilor neîncrezute urmează [documentația constructorului Sharp](https://sharp.pixelplumbing.com/api-constructor/).

## Limite precise

Testele apelează handler-ele API cu NextRequest; nu sunt o sesiune completă de utilizare autentificată în browser și nu reprezintă un test Stripe de la cap la coadă. Capturarea și notificările sunt simulate la granița serviciilor externe. Alocarea marketplace este precondiție în scenariul de execuție; alocarea echipei este testată prin API.

Nu au fost efectuate încasări, rambursări sau plăți reale, autentificare manuală în conturi reale, teste pe dispozitive fizice, verificare vizuală integrală a dashboardurilor private, test de încărcare sau restaurare de backup. Validarea tehnică a imaginii nu dovedește că fotografia reprezintă lucrarea realizată.

Înainte de producție rămân necesare verificarea autentificată a dashboardurilor în staging, fluxul complet cu Stripe de test, verificarea mobilă pe dispozitive și backup/restore. Lista funcționalităților rămase din brief este în `NITIDO-V3-IMPLEMENTATION.md`.
