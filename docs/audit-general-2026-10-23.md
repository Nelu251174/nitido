# Verificare generală NÍTIDO — 23 octombrie 2026

Auditul a identificat și corectat vulnerabilități de dependențe, titluri lipsă în conturi, contrast insuficient în rezervare, spațierea textului față de fotografia principală pe telefon și poziția de derulare la schimbarea filelor clientului. Validarea completă a aplicației Android instalate de client rămâne deschisă.

## Domeniu și rezultate

Codul aplicației verificat: `6fed1284776af4c94ccfebc8f284fdcc9564a9f0`, în [PR 136](https://github.com/Nelu251174/nitido/pull/136). Comiturile ulterioare ale raportului și corecțiile exclusiv ale instrumentelor QA nu schimbă acest cod compilat.

| Verificare | Rezultat și limită |
| --- | --- |
| Regresie automată | 2.320 teste / 220 fișiere reușite; ESLint fără erori sau avertismente. Date izolate, furnizori externi simulați. |
| Build de producție și TypeScript | Reușit, 181 rute; configurația publică Pro identică între compilare și execuția QA. |
| Browser public, client, firmă, echipă | 51 verificări reușite, 21 pagini, 63 aranjări la 360/768/1440 px, fără erori de execuție sau încălcări axe WCAG A/AA în paginile analizate. Nu constituie certificare integrală WCAG. |
| Titlu și fotografie pe telefon | Distanță minimă de 12 px între coloane, verificată în română și engleză la 361/390/402/430/600/760 px. |
| Navigarea clientului | 7 probe reușite: file repetate, formular, mesaje, istoric, rezervări și detalii, portret/peisaj, afișare desktop. Răspunsuri API sintetice interceptate. |
| Admin și Pro | 31 verificări funcționale și 108 aranjări reușite pe sursa inițială `8b6ffab`, înaintea corecțiilor finale de metadate/navigare: autentificare parolă + TOTP, roluri, izolare proprietăți/adrese/finanțe, rapoarte și formulare. Date sintetice într-o bază temporară. |
| LIVE și sandbox înainte de schimbare | 66 verificări HTTP și 50 resurse JS/CSS reușite. API-urile private refuză accesul anonim; `/api/auth/me` răspunde conform contractului cu `user:null`. |
| Recuperare și operațiuni | 33 probe automate reușite; copii ale bazelor și fișierelor, integritate și restaurare izolată verificate pe ambele medii înainte de schimbare. |
| iPhone | Simulator iPhone 17 Pro / iOS 26.4: compilare, trei porniri la rece, mod luminos/întunecat reușite. Compilarea nesemnată pentru dispozitiv a trecut și pe codul final. Primirea push confirmată anterior de beneficiar este păstrată ca dovadă; nu s-a trimis încă o notificare. |
| Android | Compilarea nativă nouă a trecut. Candidații 25/26 aveau probe de pornire pe emulatoare Android API 26/35/36. Aceste probe nu identifică și nu validează binarul instalat de client din Google Play. |

## Corecții

- Next.js și configurația ESLint actualizate la 16.4.3; `follow-redirects` la 1.16.1; actualizări compatibile Vitest/Vite. Scanarea dependențelor de producție a trecut de la o vulnerabilitate critică la zero vulnerabilități critice.
- Funcția de traducere a metadatelor păstrează acum câmpurile moștenite din layout. Șase pagini private reverificate au titluri valide; există test de regresie pentru moștenire și ștergere explicită.
- Textul evidențiat din rezervare folosește verdele închis cu contrast adecvat. Textul principal de pe telefon are spațiu separat de fotografie.
- Filele mobile resetează poziția la schimbarea paginii, iar ancorele se restaurează după autentificare și montarea conținutului. Traseul anterior eșua la revenirea Mesaje → Acasă; acum trece împreună cu istoricul și legăturile directe.
- Ceasul din operațiunile zilnice și modificările seriilor folosește mecanismul next-intl de actualizare periodică. Erorile ESLint ale scripturilor CommonJS au fost corectate fără schimbarea operațiunilor executate.

## Probleme rămase

1. **Android — prăbușire imediată la pornire pe telefonul clientului.** Nu există încă versiune exactă / stack trace pentru binarul afectat. Accesul de citire Play/raportare a erorilor este blocat de permisiunile API/configurația disponibilă. Nu este corect să declarăm problema rezolvată doar pe baza emulatoarelor. Niciun binar nou nu a fost încărcat în magazine prin acest audit.
2. **Traduceri incomplete.** Extragerea din codul curent, executată pe o copie izolată, găsește 5.212 texte față de 4.651 în catalogul publicat; 641 chei extrase lipsesc, dintre care 25 pe pagina principală. Extragerea include euristici, deci cifra nu reprezintă automat 641 texte vizibile utilizatorilor. Interfața engleză amestecă în mod confirmat texte englezești și românești. Validarea structurală a celor nouă cataloage nu dovedește acoperirea codului curent.
3. **Dependență GeoIP.** Rămân o alertă high pentru `ip-address` și una moderate pentru `geoip-country`. Importul vulnerabil a fost găsit în utilitarul de actualizare al pachetului, nu în calea de lookup folosită de aplicație. Nu am forțat o versiune majoră incompatibilă pentru a ascunde alertele; este necesară înlocuirea/actualizarea controlată.
4. **Acoperire fizică limitată.** Primirea push iPhone este confirmată. Toate fluxurile pe iPhone fizic, primirea push Android și crash-ul binarului Google Play nu sunt validate integral prin acest audit. Clientul Expo alternativ din `mobile/` are separat 11 alerte (6 high, 5 moderate); acesta nu este shell-ul Capacitor verificat pentru magazine.

Plățile Stripe TEST, HOLD/capture și testul push deja confirmate nu au fost repetate ca tranzacții externe. Probele automate financiare folosesc date izolate și furnizori simulați. Auditul nu modifică tarife, comisioane sau contractele rezervărilor existente.

## Publicare și dovezi

Corecțiile website-ului au fost publicate pe sandbox la 19:16 UTC și pe LIVE la 19:20 UTC, ambele sănătoase, sursa `6fed128`. După publicare au trecut 66 verificări HTTP și 48 resurse JS/CSS; regulile CSS corectate sunt prezente pe ambele medii. Nu s-a publicat un binar nou în magazine. Sursele exacte și rezultatele finale sunt în [fișierul de dovezi](evidence/general-audit-20261023.json). Planul de revenire al codului păstrează `be64a36a4a1da3ff46870e64e33d58365d90a425`, împreună cu bazele și fișierele existente.

- [CI website și simulator iPhone, sursa inițială a auditului](https://github.com/Nelu251174/nitido/actions/runs/40005354948)
- [Compilare Android](https://github.com/Nelu251174/nitido/actions/runs/40005354716)
- [Compilare iOS pentru dispozitiv, cod final](https://github.com/Nelu251174/nitido/actions/runs/40009531603)

Auditul nu declară brief-ul finalizat cât timp crash-ul Android și validările fizice rămân deschise.
