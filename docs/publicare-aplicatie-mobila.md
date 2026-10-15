# Publicare aplicație mobilă NITIDO (Capacitor) — App Store & Google Play

## Stare verificată în E2, 13 septembrie 2026

Acesta este ghidul istoric pentru shell-ul Capacitor. `capacitor.config.ts` indică `https://nitido.ro`, iar pluginul push a fost eliminat din configurația curentă. Nu este demonstrată primirea notificărilor native în această variantă. Aplicația Expo din `mobile/` este o implementare separată, cu același identificator aprobat; un redeploy al sandboxului nu o instalează pe telefon. Buildul aflat în TestFlight trebuie identificat după versiune/build și sursă înainte de a atribui rezultatele unei implementări. [Starea și gate-ul E2](NITIDO-E2-ACCEPTANCE.md).

## Ce este aplicația
Aplicația NITIDO (Capacitor, `appId: ro.nitido.app`) încarcă site-ul live
`https://nitido.ro` într-un **shell nativ**. Capabilitățile native se verifică în configurația și binarul efectiv distribuit.

**Avantaj mare:** fiindcă încarcă site-ul live, aplicația conține automat tot ce
e pe site (Nitido Scan, Express 60, rating etc.). După ce e publicată o dată,
actualizările paginilor încărcate de shell pot apărea după redeploy. Modificările pluginurilor, permisiunilor și codului nativ necesită un build nou și distribuire prin magazine.

Proiectele native sunt deja generate: `android/`, `ios/`, `capacitor.config.ts`.
Nume: **NITIDO**. Versiune de start: Android `versionCode 1` / `versionName 1.0`,
iOS build 1.

---

## De ce ai nevoie (o singură dată)
- **Google Play Console** — cont developer, 25$ o singură dată. *(începe aici — e mai ieftin, mai rapid, review mai indulgent)*
- **Apple Developer Program** — 99$/an.
- **Un Mac cu Xcode** pentru build-ul iOS (sau un serviciu de build în cloud). Android se face pe Windows/Mac/Linux cu Android Studio.
- **Iconițe & capturi de ecran** (le pot pregăti eu — vezi mai jos).
- **Politica de confidențialitate** publică (avem deja `nitido.ro/confidentialitate`).

---

## Textele pentru magazine (RO)

Folosește pachetul canonic [METADATA-RO.json](store/METADATA-RO.json) și
[STORE-METADATA-RO.md](store/STORE-METADATA-RO.md), cu descrierea Google corectată
la 14 octombrie 2026. Pentru Google se folosesc câmpurile `google.title`,
`google.shortDescription` și `google.fullDescription`.

Textul istoric din acest ghid a fost retras: promitea preluare garantată în
60 de minute și folosea formulări ambigue despre urmărirea lucrării și plăți.
Aceste promisiuni nu trebuie copiate în listarea magazinului. Existența acelui
text în ghid nu dovedește că el a fost trimis în consola Google.

Numele și metadatele Apple rămân în câmpurile `apple` și `shared` ale pachetului;
această corecție Google nu modifică aplicația iOS aprobată.

---

## Pași — Google Play (începe aici)

1. **Android Studio** instalat. În folderul proiectului:
   ```bash
   npx cap sync android
   npx cap open android
   ```
2. În Android Studio: **Build → Generate Signed Bundle / APK → Android App Bundle (.aab)**.
   - La prima dată creezi un **keystore** (fișier de semnare) — păstrează-l în siguranță, e obligatoriu la fiecare update viitor. (Sau folosește „Play App Signing", recomandat de Google.)
3. Firebase (pentru push): creezi un proiect Firebase cu package `ro.nitido.app`, descarci `google-services.json` și îl pui în `android/app/`.
4. În **Google Play Console**: creezi aplicația, completezi listarea din pachetul canonic, încarci capturile, setezi content rating și politica de confidențialitate (`nitido.ro/confidentialitate`).
5. Încarci `.aab`-ul pe canalul de **testare internă** întâi (verifici pe telefonul tău), apoi promovezi la **Production**.
6. Trimiți la review. De obicei 1-3 zile.

## Pași — App Store (necesită Mac + Xcode)

1. Pe Mac, în folderul proiectului:
   ```bash
   npx cap sync ios
   npx cap open ios
   ```
2. În Xcode: setezi **Team**-ul (contul Apple Developer), **Bundle Identifier** `ro.nitido.app`, versiunea și build number.
3. Pentru push: configurezi **APNs** (cheia `.p8`) în contul Apple Developer.
4. **Product → Archive**, apoi **Distribute App → App Store Connect**.
5. În **App Store Connect**: creezi aplicația, completezi listarea (texte + capturi), politica de confidențialitate, informațiile de review.
6. Trimiți la review. De obicei 1-3 zile.

---

## Sfat important pentru App Store (ca să treacă de review)
Notele pentru review trebuie să descrie numai funcțiile demonstrate în buildul trimis. Nu se promite acceptarea de către Apple și nu se declară push nativ activ pe baza existenței unui endpoint web.

---

## Ce am nevoie de la tine ca să te împing mai departe
1. Confirmi că ai (sau creezi) conturile: **Google Play Console** și **Apple Developer**.
2. Îmi spui dacă ai acces la un **Mac cu Xcode** (pentru iOS) — dacă nu, mergem întâi doar pe Android și găsim o soluție pentru iOS.
3. Dacă vrei, îți pregătesc **capturile de ecran** pentru magazine (din ecranele reale ale site-ului) și **varianta în engleză** a textelor.

Recomandarea mea: **începem cu Google Play** (mai simplu, mai ieftin), publicăm
acolo, apoi facem iOS.
