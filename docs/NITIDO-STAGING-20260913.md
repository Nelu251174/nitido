# NITIDO — dovezi operaționale, 13 septembrie 2026

## Versiuni efectiv instalate

- Sandbox: `c211ba84af5f6c279131b6b0b350c4cbf3ab3fe4`, PR #49, imagine Docker verificată pe server după instalarea webhookului Connect (candidatul anterior: `22ae94c`).
- Producție: `f3584d3dfc8a859f6780e2dff21e440d106a0456`. PR #49 nu este instalat în producție.
- Accesul administrativ Coolify și terminalul serverului au fost verificate prin `https://coolify.nitido.ro` în sesiunea de operare. Aceasta nu garantează persistența autentificării în sesiuni viitoare.

## Backup și migrare

Aplicațiile au fost oprite individual pentru copiere coerentă, apoi repornite. Nu au fost opriți ceilalți consumatori ai serverului.

| Mediu | Copie pe server | Dovezi |
|---|---|---|
| Producție | `/root/nitido-release-backups/20260913T094016Z` | SQLite backup, copie director uploads, checksumuri SHA-256, integritate și foreign keys pe copia bazei și copia separată de verificare |
| Sandbox | `/root/nitido-sandbox-release-backups/20260913T094655Z` | Aceleași verificări |

Fiecare manifest conține două fișiere: baza și metadatele versiunii; directoarele uploads copiate nu conțineau fotografii. Copiile sunt pe același server, nu reprezintă backup off-site sau o probă completă de disaster recovery cu repornirea aplicației restaurate.

După instalarea candidatului în sandbox: HTTP 200 pentru homepage și login client; integritate SQLite și foreign keys fără erori; tabelele `selection_confirmations`, `admin_session_mfa`, `admin_totp_state`, `admin_used_recovery_codes`, `admin_login_limit` prezente.

## Corecție de configurație în producție

Hashul admin avea format invalid în container, iar logul Compose raporta substituții de variabile. Setarea `NITIDO_ADMIN_PASSWORD_HASH` a fost trecută la interpretare literală în Coolify, fără schimbarea valorii salvate. Redeploy `adv6rtpjofp4fdh9j9ggaaw8`, finalizat la 09:45:35 UTC: format bcrypt valid în containerul nou, secret TOTP prezent cu format valid, homepage HTTP 200. Nu este dovadă de login MFA sau de posesie a factorului de către beneficiar. Recuperarea admin rămâne neconfigurată.

## Stripe sandbox

Cheia de test instalată a fost verificată prin citirea autentificată a identității contului: `acct_1UE6GE8ARvpRkNS9`, contul NITIDO sandbox disponibil și prin conectorul Stripe. Nu au fost citite sau mutate fonduri live.

- Endpoint creat: `we_1UFA9C8ARvpRkNS9C63D9tbd`, exclusiv test, `connect=false`, versiune API `2026-07-29.dahlia`.
- Destinație: `https://sandbox.nitido.ro/api/stripe/webhook`.
- Evenimente: `payment_intent.canceled`, `charge.succeeded`, `refund.created`, `refund.updated`, `refund.failed`, `charge.refunded`, `charge.dispute.created`, `charge.dispute.closed`, `transfer.updated`, `transfer.reversed`.
- Secretul de semnare și identificatorul contului au fost salvate în Coolify pentru runtime, fără disponibilitate în build și fără valori secrete în acest raport.
- Redeploy `tvrnwmf1pi2bz2is0shunsm8`, finalizat la 10:00:10 UTC, același candidat `22ae94c`.
- Verificare runtime: secret prezent, identificator cont corespunzător; POST fără semnătură și POST cu semnătură invalidă respinse cu HTTP 400.

Aceste probe nu demonstrează încă livrarea unui eveniment semnat de Stripe. Contul nu avea PaymentIntent-uri la verificare. Endpointul platformei nu primește evenimentele conturilor Connect; acestea au fost configurate separat în continuarea de mai jos. Conectorul disponibil a expus citirea PaymentIntent-urilor, nu operația de creare solicitată prin căutarea API.

## Continuare E2: Connect instalat în sandbox

- Cod: `c211ba84af5f6c279131b6b0b350c4cbf3ab3fe4`; CI `34751540116` finalizat cu succes pentru web, mobil și securitate.
- Local: 48 teste webhook, 8 teste release gate/preflight, TypeScript, lint pentru fișierele schimbate și build trecute.
- Endpoint Connect de test creat cu `connect=true`: `we_1UFAWE8ARvpRkNS97HXaM5Kk`, în `acct_1UE6GE8ARvpRkNS9`, API `2026-07-29.dahlia`.
- Destinație: `https://sandbox.nitido.ro/api/stripe/connect-webhook`; evenimente: `account.updated`, `payout.paid`, `payout.failed`.
- `STRIPE_CONNECT_WEBHOOK_SECRET` salvat în Coolify doar la runtime; valoarea nu este inclusă în documente, cod sau rezultate afișate.
- Deployment `lhxja62h29ypslsram2qeh26`: rolling update încheiat la 10:23:16 UTC. Container `civaeb8joydtchvzlen6pivq-102234385582`, imagine `civaeb8joydtchvzlen6pivq:c211ba84af5f6c279131b6b0b350c4cbf3ab3fe4`, în execuție.
- Probe pe containerul nou: secret Connect prezent și diferit de secretul platformei; cheie Stripe în mod test; identificatorul platformei corespunde contului sandbox.
- HTTP: endpointul Connect fără semnătură și cu semnătură invalidă returnează 400; endpointul platformei fără semnătură returnează 400; homepage sandbox, login client și homepage producție returnează 200.
- SQLite în sandbox: `integrity_check` și `foreign_key_check` fără erori.

Configurația și protecția HTTP sunt demonstrate. Livrarea reală Stripe, asocierea cu o firmă locală de test, retry-ul și reconcilierea payout rămân nedemonstrate. Căutarea conectorului pentru listare/retrimitere de evenimente nu a expus operația necesară. Nu au fost fabricate evenimente financiare pentru a declara acest gate închis. Contractul și criteriile de acceptare sunt în [NITIDO-STRIPE-CONNECT-WEBHOOK.md](NITIDO-STRIPE-CONNECT-WEBHOOK.md).

## Continuare E2: recuperare periodică instalată

- Cod instalat neschimbat: `c211ba84af5f6c279131b6b0b350c4cbf3ab3fe4`. Au fost adăugate în Coolify, doar la runtime, activarea explicită și secretul dedicat recuperării; nu au fost schimbate cheile Stripe.
- Deployment de configurație `htg4m6ipmjehyhtbxi9brzhk`, rolling update încheiat la 10:29:59 UTC, container `civaeb8joydtchvzlen6pivq-102951345818`.
- Verificate înainte de prima rulare: imaginea exactă, cheia Stripe de test, originea sandbox, contul așteptat, transferurile dezactivate, secret de minimum 32 caractere și distinct de secretele webhookurilor/cronului.
- Prima rulare în container: exit 0, `completed`, `attempted=processed=deferred=failed=0`; inboxul și anulările eligibile erau goale.
- Sarcină Coolify: `NITIDO sandbox financial recovery`, ID `vw69vmqmqqebr7z2fnnyquin`, activă, program `* * * * *`, comandă `node /app/scripts/financial-recovery-runner.mjs`, timeout 70 secunde, serviciu sandbox cu un singur container.
- Prima execuție automată: 10:32:02 UTC, Success, lot gol. SQLite confirmă rulările `completed` la 10:30:32 și 10:32:02 UTC.
- Protecția endpointului verificată: POST fără secret și POST cu secret greșit produc HTTP 401. Homepage sandbox HTTP 200; integritatea SQLite și foreign keys fără erori.
- Producția: imagine `f3584d3dfc8a859f6780e2dff21e440d106a0456`, recuperare periodică dezactivată.

Instalarea și declanșarea periodică sunt demonstrate. Nu există încă dovadă pe țintă pentru recuperarea unei restanțe Stripe, retry după întrerupere, concurență sub sarcină sau reluarea unei restanțe după restart. Acestea rămân probe financiare deschise, fără a redeschide instalarea schedulerului.

## Restanțe E2 și decizia de lansare

- Admin/MFA în sandbox neconfigurat; autentificare client/firmă/admin și recuperare nedemonstrate.
- Livrare webhook reală, challenge 3DS, ciclu financiar integral și reconciliere payout nedemonstrate.
- Dispozitive fizice și acceptare vizuală integrală restante.
- Backup off-site și restaurare operațională integrală restante.
- Aprobarea beneficiarului pentru instalare/publicare este primită; nu se solicită repetarea ei. Dovezile tehnice lipsă nu sunt marcate PASS prin această aprobare.

E2 rămâne activă. E3–E5 și acceptările restante E0/E1 nu sunt închise. Instalarea în sandbox și repararea configurației producției sunt executate; promovarea PR #49 în producție rămâne neexecutată.
