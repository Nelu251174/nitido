# NITIDO — Capacitor și publicarea în magazine

Candidatul pentru actualizarea aplicației existente rămâne **Capacitor**, bundle/package
`ro.nitido.app`, cu identitatea de semnare existentă. Proiectul Expo din `mobile/`
este auditat separat; același ID nu dovedește că poate înlocui binarul existent.
Nu crea alt keystore și nu reseta contoarele de versiune.

## Starea verificată la 9 octombrie 2026

| Probă | Ce dovedește | Limită |
|---|---|---|
| Android debug #25, SHA `19047e8e1276167f49e0095674c67e911179068e` | APK descărcat, semnătură Debug v2 validă, target API36, identitate corectă, ZIP/ELF16KB | versionCode1; nu este candidat semnat pentru Play |
| Android release #18, 24 septembrie | AAB semnat cu cheia upload existentă, toate546intrările payload verificate; versionCode18, API36, BundleConfig16KB | Google Play upload a fost **skipped**, nu dovedește publicare internă/publică |
| iOS #12, 24 septembrie | workflow archive/export/upload reușit; IPA bundle corect, build12, SDK26.5/Xcode26.6, profil distribuție/APNsproduction | Semnătura Mach-O completă nu poate fi reverificată pe Linux; nu este probă curentă App Store |
| Inspectare TestFlight din24 septembrie | build11/12 VALID, IN_BETA_TESTING, două grupuri interne | Snapshot istoric; nu acces actual, review public sau publicare App Store |

Referințe și limite detaliate: [QA pipeline](docs/upgrade/MOBILE-CAPACITOR-PIPELINE-QA.md).
Accesul actual la valorile sau starea secretelor GitHub nu este expus de connector.
Numele de mai jos sunt contractul workflowurilor, nu un inventar confirmat al consolei.

## Build și semnare

Rulează `npm ci`, apoi `npx cap sync android` / `npx cap sync ios` în mediul de build.
Configul permite exclusiv `https://nitido.ro` și sandboxul aprobat. Candidatul store
încarcă LIVE; funcțiile web noi trebuie să existe și să fie validate acolo.
Pagina locală pentru lipsa conexiunii păstrează crem/verde și permite reîncercarea
pe originea exactă. Nu reprezintă funcționalitate offline de rezervare.

Android release cere `NITIDO_KEYSTORE_BASE64`, `NITIDO_KEYSTORE_PASSWORD` și, pentru
upload, `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`. Aliasul păstrat este `nitido-upload`,
parola cheii rămâne cea a keystoreului, conform contractului istoric existent.
Certificatul upload SHA256 verificat din AAB#18:
`c71f2804154dc17dd1507a939bc7be281e34425f54b2245fc73d6ecd3993b224`.
Verifică corespondența lui în Play Console; cheia App Signing gestionată de Google
poate avea alt certificat. Gradle refuză release fără configurare completă/versiune.
Workflowul verifică fiecare intrare semnată, identitatea/API36, ELF și APK generat16KB.

iOS release cere `APPLE_TEAM_ID`, `APP_STORE_CONNECT_KEY_ID`,
`APP_STORE_CONNECT_ISSUER_ID`, `APP_STORE_CONNECT_API_KEY`. Cheia temporară are
permisiuni restrictive și se șterge la final. Preflightul autentifică exact
`ro.nitido.app`, parcurge buildurile Apple și refuză reutilizarea numărului.
Archive folosește semnare automată; IPA exportat este verificat pe macOS cu
`codesign --verify --deep --strict`, profil, entitlements, versiuni și SDK.
Compile QA separat (`mobile-native-qa.yml`) este **nesemnat**, fără secrete,
archive/export/upload. Reușita lui nu dovedește un IPA semnat.

## Trimiterea unui candidat

Pushurile pe ramurile release și tagurile Play produc builduri; uploadul se execută
numai prin dispatch explicit `upload_internal=true` / `upload_testflight=true`.
Versiunile explicite trebuie să depășească maximul autentificat actual din console.
Contorul workflowului este doar fallback pentru build; nu garantează unicitatea
față de Expo, uploaduri manuale, alte workflowuri sau alte trackuri.

Inputul `evidence_json` conține numai probe publice de validare pentru SHA exact;
nu introduce tokenuri, parole, date personale sau cheia de semnare. JSON este scris
în temporarul runnerului; nu se comite un fișier cu SHA circular. Contractul este
`scripts/mobile-release-gate.mjs`: verificare în ultimele24h, identitate/platformă,
maximum store verificat, continuitate semnare, CI la același SHA, LIVE la același SHA
cu backup/recuperare verificate și compatibilitate artifact platformă. Modul `beta`
(TestFlight/internal) permite distribuirea pentru QA fără a pretinde că testarea pe
dispozitiv este încheiată. Modul `public` (implicit în script și folosit pentru
production Play) cere suplimentar metadate, Android16KB runtime și fluxuri pe
dispozitiv real: autentificare/logout, push, locație/cameră, retry offline, cerere
**și îndeplinire** ștergere cont. Receiptul trebuie
să indice raportul concret. Nu seta `verified:true` pentru verificări neexecutate.
Scriptul validează contractul dovezilor; nu autentifică el însuși afirmațiile umane.

Înainte de upload, workflowurile reverifică și accesul real/maximul store.
Preflightul Play creează un edit temporar pentru citirea tracks/bundles/APKs și
îl șterge fără commit sau modificări de track. Un număr reutilizat ori o dovadă
care nu corespunde consolei oprește uploadul.

Google workflow țintește **internal** implicit; `track=production` cere gate `public`
și acces/eligibilitate confirmate prin API. Review/eligibilitatea și decizia Google
rămân distincte de succesul trimiterii unui release. `altool` trimite buildul către App
Store Connect/TestFlight; nu completează fișa, nu trimite spre review și nu
publică în App Store. Documentația și declarațiile store se află în `docs/store/`.

## Verificări rămase

Dovezi LIVE pentru noul SHA, acces actual console/credente, builduri semnate actuale,
QA pe dispozitive reale inclusiv16KB Android și APNs/FCM, ștergere cont îndeplinită,
metadate/privacy/data-safety/review verificate și aprobarea magazinelor. Funcțiile
native sau brandingul singure nu garantează aprobarea Apple. Nu marca review/publicare
ca finalizate pe baza unui APK debug ori a unei rulări istorice TestFlight.
