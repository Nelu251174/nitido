# NITIDO Mobile

Fundație React Native + Expo Router pentru iOS și Android. Backendul NITIDO rămâne autoritativ pentru autentificare, joburi, preț, Accept, adresă, dovezi, plăți, recenzii, notificări și AI.

## Pornire

1. `cd mobile`
2. `npm install`
3. Copiază `.env.example` în `.env` și setează `EXPO_PUBLIC_NITIDO_API_BASE_URL` la o adresă HTTPS accesibilă dispozitivului (nu `localhost` pe telefon).
4. Pe backend activează explicit `NITIDO_ENABLE_BEARER_AUTH=true` numai în mediul mobil controlat.
5. `npm run start`

Folosește `npm run android` pentru Android. Pentru iOS este necesar macOS/Xcode sau un build EAS. Teste: `npm test`; verificare TypeScript: `npm run typecheck`.

## Configurație și securitate

Singurele variabile publice sunt URL-ul API și EAS Project ID. Nu adăuga aici chei Stripe, OpenAI, Firebase Admin, APNs sau SMS. Tokenul de sesiune este păstrat în Expo SecureStore. Prețurile și payout-ul nu sunt calculate în aplicație.

Identificatorii finali aprobați sunt `ro.nitido.app` pentru iOS și Android. `OWNER_EAS_PROJECT_ID_REQUIRED`, domeniile Universal Links/App Links și URL-urile de politici rămân blocaje deliberate până la configurarea conturilor și domeniilor aprobate.

Sursa canonică aprobată rămâne `../public/icons/icon-512x512.png`: pătratul verde rotunjit cu un singur „N” alb. Derivatele mecanice, fără redesenare, sunt în `assets/`: icon iOS/store 1024 px fără transparență, foreground adaptive Android și icon monocrom pentru notificări. Splash-ul folosește aceeași identitate, fără branding Expo.

Buildurile de dezvoltare folosesc `expo-dev-client`; Expo Go nu este mediul final pentru Camera, SecureStore, Location și Notifications. Comenzile pregătite sunt `eas build --profile development --platform ios` și `eas build --profile development --platform android`, dar nu trebuie executate înainte de aprobarea identificatorilor și legarea proiectului EAS.

Firebase Android așteaptă `mobile/google-services.json`, ignorat de Git. APNs se configurează în EAS/Apple Developer; cheia `.p8`, certificatele și profilele nu se salvează în repository. Vezi `DEVICE_BUILD_READINESS.md` pentru checklistul complet.

## Permisiuni

- Camera/fotografiile sunt cerute numai în fluxul de atașare/dovadă.
- Locația foreground este cerută numai pentru traseul lucrării active; nu există tracking permanent sau background.
- Notificările sunt cerute după explicația din setări, apoi tokenul este înregistrat la `/api/push/register`.

Push folosește tokenul nativ APNs/FCM, compatibil cu providerii existenți ai backendului. Necesită un proiect EAS și credențiale APNs/FCM configurate în infrastructura Expo/EAS. Deep linkurile transportă doar identificatori siguri; ecranul reîncarcă datele și autorizarea de la backend.

## Suprafețe pregătite

Client: Home, postare (10 pași), lucrări/detaliu/timeline/hartă/mesaje/plată/finalizare/recenzie, profil, setări și AI Support.

Firmă: feed/alertă/preview/Accept, lucrare activă, hartă, dovezi ARRIVAL/COMPLETION, finalizare, încasări, istoric, rating/recenzii, verificare, zone, Stripe Connect, setări și suport.

Ecranele de fundație nu simulează succesul operațiunilor: fiecare CTA critic trebuie conectat la răspunsul API înainte de următorul sprint de device testing.
