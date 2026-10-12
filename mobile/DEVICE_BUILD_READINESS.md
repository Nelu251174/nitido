# NITIDO — Development Build Readiness

**Actualizare 9 octombrie 2026:** candidata principală pentru continuarea publicării este
aplicația Capacitor existentă; Expo rămâne alternativa React Native. Identitatea comună
`ro.nitido.app` este păstrată. Exporturile Expo iOS/Android/web și verificările locale nu
reprezintă builduri semnate sau probe fizice. Auditul actual și restanțele sunt documentate
în [STORE_RELEASE_READINESS.md](STORE_RELEASE_READINESS.md). Secțiunea din 14 septembrie
de mai jos descrie verificarea istorică a proiectului Expo.

## Identitate aprobată de OWNER

- iOS Bundle Identifier: `ro.nitido.app`
- Android Package Name: `ro.nitido.app`
- Scheme intern: `nitido`
- EAS Project ID verificat în Expo: `3887c4e7-445a-4954-9d04-7c8adc8519f9`.
- Owner și slug: `nitido-ro` / `nitido-ro`.

Identitatea proiectului este conectată în cod. Aceasta nu confirmă semnarea, generarea sau instalarea unui build.

## API pe dispozitiv

- Web local: `http://localhost:8081`.
- Telefon pe LAN controlat: backend accesibil prin IP-ul LAN al calculatorului; `localhost` ar indica telefonul, nu calculatorul.
- Development/staging real: URL HTTPS accesibil dispozitivului în `EXPO_PUBLIC_NITIDO_API_BASE_URL`.
- Production Expo: `https://nitido.ro`, configurat explicit în profilul EAS production.
  Configul refuză un API absent sau sandbox pentru acest profil.

## Configurație externă necesară

### Apple

- Apple Team ID și cont Apple Developer.
- Bundle ID aprobat și App ID în Apple Developer.
- APNs Key ID și cheia privată `.p8`, încărcată prin flux securizat EAS, nu în Git.
- Certificate și provisioning profile pentru dispozitivele de test.
- Associated Domains aprobate și fișierul `apple-app-site-association` servit prin HTTPS.

### Android / Firebase

- Aplicație Firebase creată cu package name-ul aprobat.
- `google-services.json` plasat local la `mobile/google-services.json`; fișierul este ignorat de Git.
- Credențialele Firebase Admin/FCM rămân numai pe backend.
- Keystore/signing gestionat de EAS sau printr-un flux securizat, niciodată publicat în repository.
- App Links aprobate și `assetlinks.json` servit prin HTTPS.

### Expo / EAS

- Cont/organizație Expo aprobată.
- Proiect legat și Project ID real verificat: `3887c4e7-445a-4954-9d04-7c8adc8519f9`.
- `EXPO_PUBLIC_EAS_PROJECT_ID` poate conține numai UUID-ul public al proiectului.

## Deep links pregătite

Schema `nitido://` este activă. Payload-ul deschide doar o rută internă; autentificarea și autorizarea sunt reverificate prin backend pentru job preview, job client, lucrare activă firmă, payment, review și support. Universal Links/App Links rămân dezactivate până la aprobarea domeniilor și publicarea fișierelor de asociere.

## Matrice fizică — iOS și Android

Execută aceeași matrice pe un dispozitiv compact și unul modern/large:

1. Instalare development build, splash și icon.
2. Lansare, Welcome, înregistrare Client/Firmă, login și logout.
3. SecureStore: închidere/repornire și restaurarea sesiunii; expirare/401.
4. Cameră și galerie: refuz permisiune, acceptare, preview, upload și retry.
5. Client: postare completă, quote autoritativ, publicare, My Jobs și Job Detail.
6. Firmă: feed sigur, Accept concurent, adresă numai după alocare.
7. Fotografie sosire, start, fotografie finală și finalizare.
8. Locație foreground: refuz, acceptare, tracking activ și oprire la finalizare.
9. Notificări: permisiune contextuală, token refresh, logout/revoke și deep links.
10. Push pentru mesaje, job nou, Accept, sosire și finalizare; SMS rămâne amânat.
11. Background/foreground: revenire în app fără listener dublu sau stare stale.
12. Plată/status payout în mod test, fără transferuri reale.
13. Recenzie verificată după finalizare și blocarea duplicatului.
14. AI Support, răspuns lung, retry/offline și rol corect.
15. Rețea lentă/offline pentru quote, Accept, upload și completion; fără duplicate.
16. Serviciu cu minimum două fotografii: toate cerințele și checklistul specific rămân
    identice snapshotului serverului; nu se substituie template-ul curent.
17. Finalizare în timpul pornirii GPS: watcher-ul întârziat se închide; nu trimite locații
    către următoarea lucrare.
18. Recuperarea parolei: răspuns generic, indisponibilitate email, resetare prin link HTTPS,
    apoi autentificare cu noua parolă.
19. Confidențialitate/termeni și cerere ștergere: confirmare, anulare, retry/idempotency,
    stare în analiză, fără mesaj fals de ștergere efectivă.

## Runbook tehnic al agentului — fără submit implicit

```sh
cd mobile
eas build --profile development --platform ios
eas build --profile development --platform android
```

Identificatorii și mandatul de pregătire/publicare sunt deja confirmate; nu este necesar
un nou pas de aprobare a lor. Pentru executarea acestor operațiuni, agentul verifică mai
întâi credențialele proiectului/platformei, fișierul Firebase pentru Android, semnarea și
dispozitivele de test. Candidatul principal pentru magazine este Capacitor, iar comenzile
de mai sus descriu builduri Expo alternative. Comanda de build nu face submit implicit;
se corelează artefactul semnat cu probele fizice și candidatul ales înainte de submit.

## Profil de test conectat — 14 septembrie 2026

Development și preview au API `https://sandbox.nitido.ro`, fără promovare în producție. Preview Android produce APK. `app.config.ts` conectează fișierul Firebase local ignorat de Git sau variabila EAS de tip fișier `GOOGLE_SERVICES_JSON`. Un build Android EAS fără acest fișier eșuează explicit. Fișierul trebuie să corespundă package-ului `ro.nitido.app`.

Profilul preview folosește APNs production pentru distribuirea ad hoc; backendul trebuie să aibă `APNS_USE_SANDBOX=false` pentru acest build, chiar dacă datele aplicației sunt în sandbox. Nu am schimbat încă această configurație pe server. Buildurile development trebuie corelate cu entitlementul efectiv de semnare înaintea probei.

Firebase Admin și cheia APNs rămân doar pe backend. GitHub App Expo nu era instalată/conectată în contul verificat. Nu există încă builduri sau credențiale iOS/Android în proiect.
