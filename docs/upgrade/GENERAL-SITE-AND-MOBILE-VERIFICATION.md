# Verificare generală NITIDO — site și aplicații, 9 octombrie 2026

Mandat: verificare generală, remedierea problemelor și pregătirea publicării în App Store și Google Play. Publicarea este autorizată; nu se solicită din nou acordul. Ștergerea datelor reale, cheltuielile noi și schimbările majore în afara proiectului rămân excluse din această autorizare.

## Verdict și varianta mobilă

**Publicarea pentru publicul general nu este încă validată.** Probele locale și CI verifică sursa și buildurile; nu dovedesc instalarea pe telefon, funcționarea furnizorilor reali sau review-ul magazinelor.

Continuăm aplicația **Capacitor** existentă, identificator `ro.nitido.app`. Istoricul verificat arată IPA iOS build 12 încărcat în TestFlight la 24 septembrie și AAB Android semnat build 18; uploadul Google Play a fost omis atunci. Niciunul nu dovedește publicarea pentru publicul general. Proiectul Expo/React Native din `mobile/` este auditat separat și păstrează aceeași identitate; nu înlocuiește automat aplicația existentă în magazine.

## Remedieri

- Next.js și configurația ESLint sunt actualizate de la 16.3.5 la 16.3.8; sharp de la 0.35.4 la 0.35.5. Dependențele compatibile axios, source-map-js și brace-expansion sunt actualizate. Override-ul strict pentru `xcode > uuid@11.1.1` este verificat prin parsarea și serializarea proiectului iOS în memorie. Auditul arborelui web de producție raportează **zero vulnerabilități**; această constatare nu înseamnă audit de penetrare sau audit curat pentru alternativa Expo.
- API-ul detaliului autorizat al lucrării expune regulile foto și sarcinile înghețate. Dovezile unei firme istorice nu sunt atribuite firmei alocate curent. Preview-ul fără alocare păstrează restricțiile de adresă și fotografii.
- Contextul AI al firmei exclude prețul clientului; plata permisă firmei este expusă distinct. Clientul păstrează accesul la prețul propriilor lucrări.
- Inițierea ștergerii contului: formular public `/stergere-cont`, intrare în profil client/firmă, API autentificat cu confirmare explicită, registru idempotent și preluare nominală în administrare. Cererea și auditul sunt atomice. **Acest modul nu execută ștergerea**, nu pretinde că datele sunt șterse și nu stabilește arbitrar retenții sau termene. Politica și ghidul de suport descriu fluxul implementat.
- Web: linkuri-imagine cu nume accesibil, calendar operabil prin tastatură, corecții de contrast și afișare pe ecrane mici. Paleta, geometria, navigația și conținutul aprobat sunt păstrate.
- Expo: profil production cu API HTTPS și AAB, verificare package Firebase, permisiuni limitate, flux real de recuperare parolă, inițiere ștergere, fotografii multiple și checklist din snapshot, oprirea abonamentelor GPS întârziate și curățarea sesiunilor invalide.
- Capacitor: backupul OS al datelor WebView este dezactivat pe Android; fallbackul offline permite retry către originea HTTPS aprobată. Pipelineurile verifică identitatea, continuitatea semnării și versiunile. Beta internă permite executarea QA pe telefoane; publicarea pentru public cere separat rezultatele dispozitivelor, îndeplinirea ștergerii și declarațiile magazinelor. Vitest/UI sunt actualizate la 4.1.11.

## Probe locale finalizate

| Probă | Rezultat | Limită |
|---|---|---|
| Regresie web UTC | 1.768/1.768, 165 fișiere | Date sintetice, fără furnizori reali |
| Regresie web Europe/Bucharest | 1.768/1.768, 165 fișiere | Aceeași sursă, fără tranzacții reale |
| Scripturi operaționale și gate nativ | 52/52 | Include 8 teste ale gate-ului; nu dovezi reale store |
| Build web webpack + TypeScript | PASS, 151 pagini, Next.js 16.3.8 | Build local; nu deployment |
| QA operațională admin/Pro | 31/31 scenarii, 108/108 lățimi, zero erori JavaScript | 4 roluri interne MFA și Pro Owner/Viewer; date sintetice |
| QA generală web | 39/39 scenarii, 21 pagini, 63/63 lățimi, zero încălcări axe și excepții JavaScript | Detector automat; nu certificare WCAG completă sau test de furnizori |
| Expo UTC și București | 143/143 în fiecare fus, 18 fișiere | Teste JS/contracte, fără execuție nativă pe telefon |
| Expo TypeScript și lint | PASS | Sursă Expo, distinctă de shellul Capacitor |
| Export Expo iOS/Android/web | PASS | Bundle JS/Hermes; nu IPA/AAB semnat |
| Smoke Expo web | 7/7 scenarii, 18 lățimi, zero erori JavaScript | API mock, nu device/backend LIVE |
| Expo Doctor | 19/21 | Două verificări externe blocate; nu PASS integral |

Buildul web final local este `zSoa4IIt7w7UsPV5Nn4F1`, produs din continuarea bazei `19047e8e1276167f49e0095674c67e911179068e` cu modificările acestei etape. QA generală îl verifică după corecția câmpului foto. QA operațională verifică buildul imediat precedent `X1e5KWtaYe5r-9LMIl8aU`; singura schimbare runtime ulterioară este CSS-ul limitat la câmpul foto VisitCare. Un SHA de bază nu este prezentat ca SHA al unui checkout modificat. UTC și testele Expo UTC sunt reluate cu Vitest 4.1.11; București este verificat local înaintea actualizării instrumentului, iar CI validează ambele fusuri pe candidatul final.

Buildurile native și rezultatele CI ale candidatului final se completează după terminarea verificărilor. [Audit web](GENERAL-WEB-QA.md), [audit Expo](../../mobile/STORE_RELEASE_READINESS.md), [pipeline Capacitor](MOBILE-CAPACITOR-PIPELINE-QA.md), [inventar de date](MOBILE-STORE-DATA-INVENTORY.md), [inițiere ștergere](ACCOUNT-DELETION-INTAKE.md), [pachet pentru magazine](../store/README.md).

## Blocaje reale înainte de publicare

1. **Server și LIVE.** În mediul curent accesul direct la NITIDO primește 403 de la filtrul de rețea, înainte de autentificare. Domeniile NITIDO nu sunt permise și nu există legături de credențiale pentru Coolify/server. Nu pot confirma SHA-ul servit, schema, volumele, configurarea legală, furnizorii, backupul sau migrarea efectivă. Shellul Capacitor încarcă LIVE; un APK nou singur nu publică modificările web.
2. **Console și semnare curentă.** Conectorul GitHub confirmă repository și istoric, dar nu poate lista/verifica secretele Actions. Semnarea și uploadul istoric nu dovedesc accesul actual Apple sau Play. Nu regenerăm cheia Android și nu presupunem că nu există credențiale în GitHub doar fiindcă mediul local nu are credențiale.
3. **Probe pe dispozitive și integrări reale.** Instalare/restaurare, cameră/refuz, GPS, notificări foreground/background/închisă, deep link, offline, autentificare și plata de test/3DS necesită executare pe iOS și Android împotriva backendului candidat. APK-ul verificat static sau un simulator nu substituie proba pe telefon.
4. **Îndeplinirea ștergerii contului.** Inițierea există; procesarea datelor asociate, excepțiile reale de retenție, termenul comunicat și confirmarea rezultatului trebuie finalizate. Nu este declarat îndeplinit criteriul magazinelor pe baza unui jurnal requested/under_review.
5. **Fișele magazinelor.** Metadatele sunt pregătite în română; consolele trebuie să confirme identitatea juridică/trader, clasificarea, declarațiile App Privacy/Data safety, capturile native și conturile de review. Eventuala cerință Google de testare închisă depinde de tipul și data contului, încă neverificate.
6. **Alternativa Expo.** Auditul dependențelor scade de la 79 la 23 intrări, fără critical; rămân 20 high și 3 moderate, cu propagări din node-forge/braces și incompatibilitatea CommonJS/ESM pentru decode-uri-component. Nu sunt ascunse prin downgrade major sau `audit fix --force`. Acestea se referă la proiectul Expo, nu sunt atribuite binarului Capacitor.
7. **Instrumente web de dezvoltare.** Auditul complet, inclusiv devDependencies, păstrează 5 intrări high propagate din braces în lanțul ESLint/micromatch. Patchul braces compatibil nu este publicat; nu se retrogradează Next.js la 14 pentru a ascunde alerta. Auditul de producție separat are zero intrări.

## Implementat, integrat, publicat

Modificările acestei etape sunt pregătite pe `codex/nitido-store-readiness`. Integrarea sursei `main` în istoricul candidatului nu înseamnă că acest candidat este instalat în `main` sau pe server. Nu există backup real, deploy LIVE sau publicare App Store/Google Play executate prin această verificare.

Agentul execută comenzile, backupul/restaurarea de control, migrarea, publicarea în sandbox/LIVE, buildurile semnate și operațiunile în console când conexiunile necesare și dovezile restante sunt disponibile. Utilizatorului nu i se transferă compilarea ori completarea tehnică și nu i se cere repetarea mandatului.
