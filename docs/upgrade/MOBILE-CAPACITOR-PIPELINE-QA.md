# Audit pipeline Capacitor — 2026-10-09

Auditul păstrează `ro.nitido.app`, workflowurile release existente și cheia upload.
Auditul inițial nu a schimbat credențiale sau trimis builduri în magazine.
Root a pornit ulterior verificările CI gratuite existente pentru repositoryul public verificat.

## Primele builduri ale acestei etape

Pentru candidatul `5ce7eff4b2fee70855db8c768ac6ba6eb9c2afaf`:

- [Android](https://github.com/Nelu251174/nitido/actions/runs/37917890800), artifact `11610503051`: APK SHA256 `cc8988cd4de33f0513d9007f76c44fdb726923d3e0d677d33fcbf30e01db90d8`. Identitate corectă, target SDK 36, `allowBackup=false`, origine LIVE HTTPS cu cleartext dezactivat, fallback `index.html` și ambele pagini offline incluse. Semnătură debug v2, `zipalign -P16`, ELF LOAD și offsets ZIP 16KB pentru cele patru ABI: PASS.
- [iOS](https://github.com/Nelu251174/nitido/actions/runs/37917955466), job `113778848309`: Xcode 26.6 build 17F113, SDK 26.5, `BUILD SUCCEEDED`. Compilare nesemnată, fără archive/export IPA sau upload. Rularea push duplicată este anulată de controlul concurenței; rularea PR a trecut.

Prima regresie CI Expo a cerut corecția lockfile-ului. Probele native de mai sus nu sunt prezentate ca artefacte ale unui SHA ulterior; rezultatele pe candidatul final apar în [PR #88](https://github.com/Nelu251174/nitido/pull/88). Jobul separat de configurare primește doar șapte booleene evaluate de GitHub și consemnează disponibilitatea legăturilor de publicare în contextul lui. Nu citește valorile secretelor, nu verifică alte environments GitHub și nu autentifică magazinele.

## Probe descărcate și inspectate

- [Android debug #25](https://github.com/Nelu251174/nitido/actions/runs/37911012509), SHA19047e8e1276167f49e0095674c67e911179068e: artifact11607170826. APK SHA256 `0267b99cc523155b5b911e749142bad3e4b295ec462554fad868d5722f2aae6e`; ro.nitido.app, version1/1.0, target36/min24. Google `apksigner` semnătură v2 Debug validă; `zipalign -c -P16 4` PASS.
- [Android semnat #18](https://github.com/Nelu251174/nitido/actions/runs/36036625352), SHA f79a8fad40491fe7eba484a81fae8446fe6e3d1c: artifact10824717603. AAB SHA256 `8a93e9c79524d4c4c0eea9aa79ee652a3fceef04e55940d41ed9b38a1b806243`, version18/1.0, target36. Java JarFile verification citește și verifică criptografic toate546intrările payload cu certificatul upload; testele negative refuză certificatul greșit și AAB fără semnături. **Play upload skipped** în această rulare.
- [iOS #12](https://github.com/Nelu251174/nitido/actions/runs/36035942741), același SHA istoric: artifact10824126956. IPA SHA256 `30de713f43ac5bd79093c8608371ae74270f8e838d63d279a5d1de914e3141e0`, ro.nitido.app, build12/marketing1.0, Xcode26.6, iphoneos26.5, minimum15. App/framework CodeResources prezente. CMS embedded profile verificat criptografic cu OpenSSL fără verificarea trust chain; entitlements suffix corespunde, get-task-allow=false, APNsproduction, fără device list, expiry2027-09-05. Linux nu poate verifica complet codesign Mach-O.
- [Inspector TestFlight istoric](https://github.com/Nelu251174/nitido/actions/runs/36039640368): appID6810752486, build11/12 VALID, IN_BETA_TESTING intern, external READY_FOR_BETA_SUBMISSION, două grupuri interne. Nu înseamnă acces curent sau App Store public.

Toate cele4ABI din APK și AAB conțin libdatastore_shared_counter.so. `readelf -lW`
confirmă LOAD alignment16384; APK debug are toate datele ZIP .so necomprimate și
aliniate16384. BundleConfig istoric cere PAGE_ALIGNMENT_16K. Acestea sunt verificări
statice; nu s-a rulat un dispozitiv/emulator cu pagini16KB.

Instrumente oficiale: build-tools36 de la dl.google.com (SHA1
b0b6376977657e8ad9b969bacf4093601da2c6fb verificat față de repository2-1.xml),
bundletool1.18.3 release Google (SHA256
a099cfa1543f55593bc2ed16a70a7c67fe54b1747bb7301f37fdfd6d91028e29,
digest oficial GitHub). Extracțiile au refuzat path traversal.
Artefactele brute/private profile rămân în workspace separat, nu în git;
`/workspace/nitido-mobile-artifact-audit-20261009/` conține rapoartele locale.

## Corecții pregătite și verificate local

- Android allowBackup=false împiedică includerea datelor WebView/sesiunilor în backupul OS.
- iOS păstrează ambele descrieri de locație cerute de geolocation8.2.2; sunt identice și descriu folosirea foreground. README-ul pluginului precizează că Always key este necesar pentru dependența ion-ios-geolocation, fără prompt background direct. Nu s-a adăugat background entitlement.
- Local server.errorPath suportat în sursele instalate Android/iOS; două pagini retry doar HTTPS LIVE/sandbox, crem/verde. DOM Chromium local:12cazuri (două pagini ×360/390/430/768/1024/1440), fără overflow și origini corecte. A fost testat prin setContent fără navigare externă. Nu s-a verificat tranziția nativă la căderea conexiunii pe dispozitiv.
- Release build refuză semnare/versiune lipsă. Cheile temporare sunt restrictive și se șterg; inputurile workflow sunt transmise prin env, nu interpolare în cod shell.
- Workflow release build-only implicit; dispatch upload este blocat până la gate beta (CI/exact SHA, LIVE/backup, semnare, store și compatibilitate artifact) și fresh store preflight. Production Google cere gate public suplimentar: device/ștergere îndeplinită/metadate și runtime16KB; TestFlight/internal permit testarea fără a pretinde că QA fizic este finalizat. Play preflight edit este șters fără commit.
- Signed IPA verify script macOS și AAB API36/native16KB/generated APK packaging gate implementate. Noile gates nu au fost executate pe candidat semnat actual; pe Linux s-a verificat sintaxa Python, iar semnarea AAB istorică a fost verificată direct.
- Gate evidence:8teste locale trecute pe Node24 și Node22 (imaginea QA existentă, fără rețea/volume), inclusiv drift SHA, identitate greșită, dovadă veche/viitoare, versiune reutilizată, LIVE diferit, fulfillment neexecutat și numeric SDK lipsă/null/string/NaN/Infinity/fractii. Teste suplimentare dovedesc că beta permite QA fără device/metadate publice, dar refuză lipsa CI/backup. Fixturele sunt sintetice, nu probe store.
- Cele4workflowuri YAML parsate și toate run blocks verificate cu bash -n; schema GitHub nativă va fi validată la noua rulare CI. Workflow macos26 unsigned compile-only nou, fără secrete/semnare/archive/upload.

## Ce rămâne necunoscut/blocat

Connectorul GitHub permite citirea rulărilor/joburilor/artifactelor, dar nu expune
Secrets API sau inventarul credențialelor. Jobul de configurare poate verifica doar
disponibilitatea în propriul context; validitatea și accesul curent rămân de probat.
La 24 septembrie secretele Apple și upload key
Android au funcționat; Play SA nu a permis uploadul (pas skipped). Nu s-au citit
valorile secretelor. Configurația curentă verificată de root, revizia11, permite doar ANAF ca custom domain și package
hosts; nu există credențiale cloud configurate, iar Coolify/store API prin shell
sunt blocate. Nu s-a ocolit policy prin proxy, alias ori webhook.

Noul cod web nu este verificat LIVE; store/device gate îl va refuza până la
probe concrete. Noua cerere/gestionare ștergere cont nu constituie singură
îndeplinire a ștergerii. Pentru minimum functionality, push/auth/camera/location
și retry trebuie probate în aplicația Capacitor pe dispozitive reale; QA Expo
ori browser web nu ține locul acestei probe.

Cerințe oficiale actuale și fișe store: `docs/store/`. SDK Apple26/API Android36
au fost confirmate ca praguri actuale din sursele oficiale; nu se aplică anticipat
pragul Apple27 din2027. Review și publicare publică sunt distincte de TestFlight/internal.
