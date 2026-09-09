# Google Play — pași OWNER (o singură dată) + robotul de upload

Robotul `Robot Google Play (semnat + upload)` construiește varianta semnată
`.aab` și o urcă automat pe **canalul de testare internă**. Ca să funcționeze,
tu (OWNER) faci o dată pașii de mai jos. Eu (Claude) pornesc robotul.

## 1. Cheia de semnare (upload key)
Îți pot genera eu cheia acum (îți dau fișierul + parolele), sau o generezi tu cu
o comandă. Rezultatul e un fișier `.keystore` + o parolă + un alias.
> Recomandat: activează **Play App Signing** (Google păstrează cheia reală de
> semnare; tu folosești doar cheia de upload, care se poate reseta dacă o pierzi).

## 2. Creează aplicația în Google Play Console
1. Play Console → **Create app**.
2. Nume: **NITIDO**, limbă implicită Română, tip **App**, gratuit.
3. La **App integrity / App signing**: activează **Play App Signing**.
4. Completează listarea magazinului (folosește textele din
   `docs/publicare-aplicatie-mobila.md`): descriere scurtă/lungă, iconiță,
   capturi, categorie, politica de confidențialitate (`nitido.ro/confidentialitate`).
5. Creează canalul **Testing → Internal testing** și adaugă emailul tău (și al
   celor ~12 testeri necesari pentru contul personal) ca testeri.

> Notă: Google cere ca **primul** pachet să fie recunoscut de aplicație. Dacă
> robotul dă eroare că `versionCode`-ul e prea mic sau lipsește setup-ul, se
> încarcă o dată un `.aab` manual din Console (îl produce tot robotul, ca
> artefact) și apoi mergem pe robot pentru restul.

## 3. Cont de serviciu (ca robotul să urce singur)
1. Google Cloud Console → proiect legat de Play → **IAM & Admin → Service Accounts → Create**.
2. Descarcă cheia **JSON** a contului de serviciu.
3. În Play Console → **Users and permissions → Invite new user** → adaugă emailul
   contului de serviciu → dă-i permisiuni de **release** (admin pe aplicație e cel mai simplu la început).

## 4. Adaugă SECRETELE în GitHub
GitHub → repo `nitido` → **Settings → Secrets and variables → Actions → New repository secret**.
Adaugă exact aceste 5 secrete:

| Nume secret | Ce conține |
|---|---|
| `NITIDO_KEYSTORE_BASE64` | fișierul `.keystore` codat base64 (ți-l dau gata) |
| `NITIDO_KEYSTORE_PASSWORD` | parola keystore-ului |
| `NITIDO_KEY_ALIAS` | alias-ul cheii (ex. `nitido-upload`) |
| `NITIDO_KEY_PASSWORD` | parola cheii |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | tot conținutul fișierului JSON de la pasul 3 |

## 5. Pornirea robotului
Când secretele sunt puse, îmi spui — și pornesc robotul (creez un tag `play-1`).
Robotul:
- construiește `.aab`-ul semnat,
- îl urcă pe Google Play, canalul **internal testing**,
- îl publică și ca artefact descărcabil.

Din acel moment, aplicația e în **testare** pe Google Play. O lucrăm cât vrem;
când e perfectă, o promovezi la **Production** și trimiți la review.
