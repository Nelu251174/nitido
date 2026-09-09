# Publicare aplicație mobilă NITIDO (Capacitor) — App Store & Google Play

## Ce este aplicația
Aplicația NITIDO (Capacitor, `appId: ro.nitido.app`) încarcă site-ul live
`https://nitido.ro` într-un **shell nativ** cu funcții native reale: splash
screen, status bar și **notificări push**.

**Avantaj mare:** fiindcă încarcă site-ul live, aplicația conține automat tot ce
e pe site (Nitido Scan, Express 60, rating etc.). După ce e publicată o dată,
**orice update de site apare instant în aplicație — fără resubmitere în magazine.**

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

**Nume aplicație:** NITIDO — Curățenie la cerere

**Subtitlu (App Store, max 30 caractere):** Firme verificate, preț fix

**Descriere scurtă (Google Play, max 80 caractere):**
Postezi lucrarea, alegi firma pe calitate. Urgent? Express 60 preia în 60 min.

**Descriere lungă:**
> NITIDO conectează clienții cu firme de curățenie verificate din România.
>
> • Postezi lucrarea în câteva minute și vezi prețul estimativ înainte.
> • Primești oferte de la firme verificate și alegi pe calitate — sau, pentru
>   urgențe, Express 60 îți garantează preluarea în 60 de minute.
> • Faci poze ghidate ale spațiului (Nitido Scan), ca firma să estimeze corect.
> • Plată securizată prin card, banii sunt eliberați după finalizarea confirmată.
> • Urmărești lucrarea live, cu dovezi foto la sosire și la final.
> • Firmele verificate primesc lucrări în zona lor, fără abonament.
>
> Prețuri transparente, firme verificate ANAF, plăți prin Stripe.

**Cuvinte-cheie (App Store):** curatenie, firme curatenie, menaj, curatenie apartament, curatenie birou, Bucuresti, Constanta, servicii, cleaning

**Categorie:** Lifestyle (sau Business).

**Ce e nou (prima versiune):** Prima versiune NITIDO: postare lucrări, oferte pe
calitate, Express 60, Nitido Scan, plată securizată, urmărire live.

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
4. În **Google Play Console**: creezi aplicația, completezi listarea (textele de mai sus), încarci capturile, setezi content rating și politica de confidențialitate (`nitido.ro/confidentialitate`).
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
Apple respinge uneori aplicațiile care sunt „doar un site într-un ambalaj"
(ghidul 4.2). NITIDO trece pentru că are **funcții native reale**: notificări
push, splash nativ, integrare cameră pentru dovezi foto. La review, subliniază
în notele pentru recenzor că aplicația oferă notificări push native și acces la
cameră pentru dovezile lucrării — nu e un simplu webview.

---

## Ce am nevoie de la tine ca să te împing mai departe
1. Confirmi că ai (sau creezi) conturile: **Google Play Console** și **Apple Developer**.
2. Îmi spui dacă ai acces la un **Mac cu Xcode** (pentru iOS) — dacă nu, mergem întâi doar pe Android și găsim o soluție pentru iOS.
3. Dacă vrei, îți pregătesc **capturile de ecran** pentru magazine (din ecranele reale ale site-ului) și **varianta în engleză** a textelor.

Recomandarea mea: **începem cu Google Play** (mai simplu, mai ieftin), publicăm
acolo, apoi facem iOS.
