# NITIDO — dovezi operaționale, 13 septembrie 2026

## Versiuni efectiv instalate

- Sandbox: `22ae94cae204c4e916c3158acd4142dc98a87ee2`, PR #49, imagine Docker verificată pe server.
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

Aceste probe nu demonstrează încă livrarea unui eveniment semnat de Stripe. Contul nu avea PaymentIntent-uri la verificare. Endpointul creat nu primește evenimentele conturilor Connect; configurarea și verificarea acestora, inclusiv payout-urile, rămân deschise. Conectorul disponibil a expus citirea PaymentIntent-urilor, nu operația de creare solicitată prin căutarea API.

## Restanțe E2 și decizia de lansare

- Admin/MFA în sandbox neconfigurat; autentificare client/firmă/admin și recuperare nedemonstrate.
- Livrare webhook reală, challenge 3DS, ciclu financiar integral și reconciliere payout nedemonstrate.
- Dispozitive fizice și acceptare vizuală integrală restante.
- Backup off-site și restaurare operațională integrală restante.
- Aprobarea beneficiarului pentru instalare/publicare este primită; nu se solicită repetarea ei. Dovezile tehnice lipsă nu sunt marcate PASS prin această aprobare.

E2 rămâne activă. E3–E5 și acceptările restante E0/E1 nu sunt închise. Instalarea în sandbox și repararea configurației producției sunt executate; promovarea PR #49 în producție rămâne neexecutată.
