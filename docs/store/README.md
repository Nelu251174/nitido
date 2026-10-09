# Pachet local App Store / Google Play — NITIDO

Pregătire în română pentru aplicația existentă `ro.nitido.app`, fără creare de conturi, schimbări de brand sau operații în magazine. Bază inspectată: `19047e8e1276167f49e0095674c67e911179068e` și modificările locale concurente de QA/deletion; acestea nu sunt declarate publicate. Data inventarului: 09.10.2026.

| Material | Stare |
|---|---|
| `METADATA-RO.json`, `STORE-METADATA-RO.md` | Draft redactat; lungimi validate; URL-urile LIVE și contul legal rămân neverificate |
| `OFFICIAL-SUBMISSION-REQUIREMENTS.md` | Cerințe oficiale Apple/Google consultate curent, cu surse și limite |
| `REVIEW-RUNBOOK.md` | Parcurs concret de review pentru agent; conturi și credenciale necreate/neinventate |
| `ASSET-INVENTORY.md` | Iconuri existente decodate și capturi QA catalogate; fără screenshots mobile finale |
| App Privacy / Data safety | Inventarul tehnic este în `../upgrade/MOBILE-STORE-DATA-INVENTORY.md`; formularul final și serviciile efective rămân neconfirmate |
| Console, semnare, distribuție, review/publicare | Se verifică separat prin conexiunile autorizate existente; pachetul de documente nu le dovedește |

Agentul operează uploadul și publicarea după verificarea conturilor existente, backendului, artefactelor și declarațiilor. Utilizatorului se cere strict autentificarea/autorizarea indispensabilă sau identitatea juridică reală lipsă; nu i se transferă compilarea ori completarea tehnică. Nu se declară App Store/Google Play publicat pe baza unui build, CI sau upload istoric.

Ruta candidatului `/stergere-cont` înregistrează cereri, fără îndeplinirea ștergerii. Termenul, confirmarea finală și rezultatul procesării sunt blocaje funcționale înainte de publicare; URL-ul nu este declarat disponibil LIVE. Istoricul TestFlight reușit și AAB semnat fără upload Play este consemnat separat în `REVIEW-RUNBOOK.md`. Ținta de release este Capacitor, nu proiectul Expo alternativ.

Inventarul datelor trebuie să țină cont de coordonatele precise salvate pentru intrarea lucrării, fotografii, comunicări, plăți și tokenuri native. Permisiunile manifestului nu măsoară singure colectarea efectivă. Nu se declară „fără date colectate” sau „fără tracking al furnizorilor” numai din absența unui tracker publicitar observat în cod.
