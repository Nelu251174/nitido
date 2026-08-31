# NITIDO — Development Build Readiness

## Identitate aprobată de OWNER

- iOS Bundle Identifier: `ro.nitido.app`
- Android Package Name: `ro.nitido.app`
- Scheme intern: `nitido`
- EAS Project ID: se completează numai după `eas init`/legarea proiectului real.

EAS Project ID rămâne placeholder și împiedică deliberat un build cloud accidental înainte de legarea proiectului real.

## API pe dispozitiv

- Web local: `http://localhost:8081`.
- Telefon pe LAN controlat: backend accesibil prin IP-ul LAN al calculatorului; `localhost` ar indica telefonul, nu calculatorul.
- Development/staging real: URL HTTPS accesibil dispozitivului în `EXPO_PUBLIC_NITIDO_API_BASE_URL`.
- Production: URL HTTPS separat, aprobat și configurat în profilul de mediu EAS; nu se hardcodează în sursă.

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
- Proiect legat prin `eas init` și Project ID real.
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
10. Push pentru job nou, Accept, sosire, start și finalizare; verificare SMS fallback în staging.
11. Background/foreground: revenire în app fără listener dublu sau stare stale.
12. Plată/status payout în mod test, fără transferuri reale.
13. Recenzie verificată după finalizare și blocarea duplicatului.
14. AI Support, răspuns lung, retry/offline și rol corect.
15. Rețea lentă/offline pentru quote, Accept, upload și completion; fără duplicate.

## Comenzi — nu trimit aplicația în store

```powershell
cd C:\Users\User\nitido\mobile
eas build --profile development --platform ios
eas build --profile development --platform android
```

Profilele `preview` și `production` sunt pregătite în `eas.json`, dar nu se execută și nu se face `eas submit` înainte de aprobarea OWNER.
