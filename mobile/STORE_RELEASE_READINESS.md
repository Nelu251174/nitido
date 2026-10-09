# NITIDO — audit Expo și pregătire magazine, 9 octombrie 2026

## Candidatul principal și identitatea

Candidatul principal pentru continuarea publicării este shellul **Capacitor** existent,
conform verificării istoricului buildurilor: IPA încărcat în TestFlight la 24 septembrie
și AAB Android semnat, fără upload Google Play confirmat. Aceste probe sunt ale
Capacitor, nu ale proiectului Expo din acest director.

Expo rămâne alternativa React Native. Ambele folosesc identitatea aprobată
`ro.nitido.app`, schema `nitido` și brandingul existent; nu sunt două aplicații distincte
publicabile cu același identificator. Auditul Expo nu înlocuiește candidatul existent.
Nu s-a executat un build EAS plătit, semnare, submit, publicare sau schimbare de server.

## Verificat local

- Teste: **143/143**, față de baza 122; 18 fișiere. Verificare TypeScript și lint fără erori.
- Expo public config și introspecție config plugins: reușite.
- Smoke pe exportul React Native **web**, cu răspunsuri API sintetice: **7/7** scenarii,
  **18** verificări de lățime (360–1440 px), fără page errors. S-au probat confirmare,
  anulare, retry/replay, Client/Firmă/neautentificat, recuperare și pagini legale.
  Aceste probe de browser nu sunt teste native și nu confirmă livrare email reală.
- Export Metro/Hermes **iOS, Android și web**: reușit, inclusiv după remedierea dependențelor.
  Exportul JS/Hermes nu este IPA/AAB semnat și nu confirmă funcționarea pe dispozitiv.
- Expo Doctor: **19/21** controale trecute. Validarea schemei prin Expo și metadatele
  React Native Directory sunt blocate de conexiunea externă (`exp.host` / răspuns remote).
  Nu sunt raportate drept verificări trecute.
- Asseturi originale păstrate: icon iOS/store 1024×1024 opac, foreground adaptive
  Android și icon notificări. Nu s-a redesenat identitatea.

## Remedieri realizate

Profilul Expo `production` indică explicit mediul EAS production, distribuție store,
API `https://nitido.ro` și Android `app-bundle`. Configurația refuză API lipsă,
sandbox sau URL nesecurizat pentru acest profil. ID-ul și versiunea aplicației existente
au fost păstrate; numărul de build crește prin EAS remote versioning.

Android EAS necesită fișierul Firebase și verifică prezența package-ului `ro.nitido.app`.
Niciun fișier Firebase, certificat, cheie sau token nu a fost adăugat în Git.

Pentru preview/production, iOS ATS refuză încărcări HTTP arbitrare. Folosim doar
criptografia platformei pentru HTTPS și SecureStore; `ITSAppUsesNonExemptEncryption=false`
este configurat pe această bază. Declarația finală din App Store Connect trebuie să
corespundă exact binarului și funcțiilor publicate.

Microfonul, Face ID, motion activity și explicațiile iOS pentru locație permanentă
au fost eliminate. Nu există locație background sau foreground service Android.
Galeria folosește selectorul sistemului pentru imaginea aleasă, fără solicitarea accesului
larg la bibliotecă; permisiunile Android READ_MEDIA și legacy storage sunt blocate.
Camera și locația foreground rămân cerute în contextul lucrării. Overlay permission
este eliminată din profilurile de distribuție. Introspecția este verificarea configului;
manifestul final al APK/AAB trebuie inspectat după build.

UI pentru Client/Firmă are acum pagini funcționale pentru confidențialitate/termeni și
**inițierea cererii de ștergere**. Confirmarea explicită trimite numai
`{confirmation:'DELETE_ACCOUNT'}` la `/api/account/deletion`, cu sesiunea autentificată.
Răspunsul pending/replayed este afișat ca cerere înregistrată/în analiză. Aplicația nu
pretinde că datele sunt șterse și nu deloghează contul automat. Finalizarea efectivă,
retenția justificată și tratarea lucrărilor în curs rămân operațiuni separate obligatorii
înainte ca fluxul să fie declarat complet pentru magazine.

Recuperarea parolei trimite cererea la API-ul existent `/api/auth/forgot-password`,
afișează mesajul generic al serverului fără a confirma existența contului/livrarea emailului
și păstrează erorile 503. Resetarea se finalizează prin linkul HTTPS din email, apoi
utilizatorul se autentifică din nou în aplicație.

Restaurarea sesiunii elimină tokenul SecureStore și la răspuns `200 {user:null}`, nu
doar la 401. Erorile temporare de conexiune nu șterg tokenul. Rolurile necunoscute nu
sunt direcționate automat în spațiul Firmă.

Execuția respectă cerințele foto salvate pe lucrare, inclusiv mai multe fotografii pentru
sosire/finalizare. Checklistul folosește `executionRules.items`/`executionItems` returnate
de server, nu o listă locală fixă. Snapshoturile legacy păstrează compatibilitatea.
Fotografiile rămân validate de backend. Retry-ul unei fotografii nu poate reutiliza un
asset pentru o altă lucrare activă. Watcher-ul GPS este eliminat la schimbarea/finalizarea
lucrării și la unmount, inclusiv dacă abonarea nativă rezolvă târziu.

## Acoperirea rolurilor și funcțiilor

| Flux | Starea Expo | Proba / limitarea |
| --- | --- | --- |
| Client / Firmă: login, signup, restaurare, logout | API + Bearer/SecureStore | teste locale; fără autentificare reală pe telefon |
| Angajat echipă | Cont Client și spațiu Colaborare după invitație | autorizarea, sarcinile, raportul și dovezile sunt controlate de backend; fără rol global inventat |
| NITIDO Pro | Nu există shell Expo pentru organizațiile `pro_*` | `NativeWorkspace` este workspace legacy Business/Host; nu îl prezentăm drept Pro. Candidatul Capacitor folosește suprafața web existentă |
| Lucrări / Accept / adresă / dovezi / finalizare | API autoritativ existent | teste contracte locale; concurrența și device upload necesită probe fizice |
| Plăți și carduri | Backend și flux HTTPS existent | fără chei Stripe în aplicație, fără plată sau transfer real în audit |
| Push | Token nativ APNs/FCM, revocare înainte de logout | lipsesc probe livrare/token refresh pe dispozitive fizice |
| Locație | Doar foreground pentru lucrarea `arrived` | teste lifecycle/race; proba GPS/refuz/foreground-backround necesită telefon |
| Ștergere cont | Cerere autentificată, idempotentă | fluxul de îndeplinire efectivă nu este implementat de Expo |

## Dependențe

Override-urile compatibile instalate și fixate în lockfile sunt `shell-quote@1.11.0`,
`brace-expansion@5.0.12`, `source-map-js@1.2.2`, `compression@1.8.2` și
`xcode > uuid@11.1.1`. Pentru uuid s-au probat require CommonJS, `v4`/`validate`,
parsarea proiectului iOS existent, generarea ID-ului Xcode și serializarea în memorie.
Nu s-a scris proiectul Capacitor.

`npm audit --omit=dev` a scăzut de la **79** intrări (36 critical, 38 high, 5 moderate)
la **23** (0 critical, 20 high, 3 moderate). Intrările includ propagarea aceleiași
probleme către mai multe pachete. Problemele sursă rămase sunt:

- `node-forge@1.4.0` și `braces@3.0.3`: patchurile 1.4.1 / 3.0.4 nu sunt publicate în
  registry-ul accesibil; cererile pentru aceste versiuni au întors 404.
- `decode-uri-component`: versiunea corectată 0.5.0 este ESM, iar `query-string@7`
  din Expo Router folosește require CommonJS. Un override direct ar rupe routerul;
  este necesară actualizarea compatibilă upstream, urmată de reexport și teste.

Auditul nu este declarat curat. Nu s-a folosit `npm audit fix --force` și nu s-a schimbat
major React Native/Expo pentru a ascunde alertele.

## Ce mai trebuie pentru validare și submit

1. Binarul candidat Capacitor și identitatea semnării trebuie corelate cu artefactele
   și istoricul existent. Expo ar necesita un proces distinct de migrare dacă este ales ulterior.
2. Confirmați în App Store Connect/Play Console conturile, semnarea, API/push și
   build/version numbers; exporturile locale nu oferă aceste credențiale.
3. Executați matricea din `DEVICE_BUILD_READINESS.md` pe iPhone/iPad și Android:
   restaurare/expirare/offline, cameră/selector refuzat, foto multiple, acceptare concurentă,
   GPS/oprit la finalizare, push/revoke/deep link, carduri și plată de test.
4. Finalizați tratarea cererii de ștergere și verificați URL-ul public
   `https://nitido.ro/stergere-cont`, politica de retenție și SLA-ul comunicat.
5. Completați App Privacy / Google Data Safety după inventarul real din
   `../docs/upgrade/MOBILE-STORE-DATA-INVENTORY.md`, inclusiv SDK-urile binarului final.
6. Pregătiți screenshoturi reale, descriere, privacy/support/deletion URLs și conturi
   demonstrative pentru reviewer fără acces la date reale. Nu inventați capturi device.
7. Rezolvați alertele de dependențe rămase și rerulați controalele externe blocate înainte
   de a prezenta un release Expo drept verificat integral.

Probele locale fără secrete sunt păstrate în `/workspace/nitido-qa-mobile-release-results`.
