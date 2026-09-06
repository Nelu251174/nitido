# NITIDO — Aplicația mobilă (Capacitor)

Aplicația mobilă e un shell nativ (Capacitor 8) care încarcă site-ul live
`https://nitido.ro` și adaugă funcții native (splash, status bar, push).
Astfel, orice update la site apare automat și în aplicație, fără re-publicare.

## Ce e deja configurat în proiect
- `capacitor.config.ts` — appId `ro.nitido.app`, appName `NITIDO`, încarcă `https://nitido.ro`.
- `android/` și `ios/` — proiectele native, gata de deschis în Android Studio / Xcode.
- Iconițe + splash NITIDO generate pentru toate mărimile (Android + iOS).
- Plugin-uri native: App, SplashScreen, StatusBar, PushNotifications.

## Pregătire (o singură dată, pe mașina de build)
```bash
npm install
npx cap sync         # sincronizează configul + plugin-urile în android/ios
```

## Android (se poate pe Windows/Mac/Linux)
1. Instalează **Android Studio**.
2. `npx cap open android` (sau deschide folderul `android/` în Android Studio).
3. Build → Generate Signed Bundle/APK → **Android App Bundle (.aab)**.
   - Prima dată creezi un **keystore** (semnătura aplicației) — păstrează-l în siguranță, e obligatoriu pentru update-uri viitoare.
4. Urci `.aab` în **Google Play Console** → creezi aplicația → completezi fișa (descriere, capturi, politica de confidențialitate: `https://nitido.ro/confidentialitate`) → trimiți spre review.

## iOS (OBLIGATORIU pe Mac cu Xcode, sau build în cloud)
1. Pe un **Mac**: `npx cap open ios` → se deschide Xcode.
2. Setează echipa (Apple Developer), semnătura, versiunea.
3. Product → Archive → Distribute App → **App Store Connect**.
4. În **App Store Connect** completezi fișa și trimiți spre review.
- Fără Mac: se poate folosi un serviciu de build în cloud (ex. Ionic Appflow, Codemagic).

## ⚠️ Important pentru aprobare (calitate maximă)
- Apple respinge aplicațiile care sunt „doar un website". De aceea aplicația are
  funcții native reale (push, splash). Recomandat: activează push-ul înainte de submit.
- Testează pe un telefon REAL înainte de submit (flux client + firmă + plată).
- Politica de confidențialitate e obligatorie în ambele magazine → `https://nitido.ro/confidentialitate`.

## Update-uri viitoare
Pentru schimbări doar de conținut/site: NU trebuie re-publicat în magazine —
aplicația încarcă site-ul live. Re-publici în store doar când schimbi funcții native
(iconițe, plugin-uri, config Capacitor): `npx cap sync` apoi rebuild.
