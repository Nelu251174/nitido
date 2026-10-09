# Promovare nitido.ro — 15 septembrie 2026

Proprietarul a autorizat explicit înlocuirea site-ului vechi cu versiunea nouă. Publicarea în magazine rămâne separată.

## Dovezi confirmate

- Sandbox: `18fef6997fbab31399b7cac557d4c6b08625e48c`, instalat cu succes; healthcheck 0 la 06:39:33 UTC.
- Producție: aplicația Coolify `zxnelxi2cejranyvfpw0scac`, domenii nitido.ro și www.nitido.ro, încă imaginea `f3584d3dfc8a859f6780e2dff21e440d106a0456`.
- Backup server: `/root/nitido-release-backups/20260915T065112Z`. SQLite backup API, date auxiliare și uploads, manifest SHA-256; configurația privată rămâne exclusiv pe server. Backup local serverului, nu copie externă. Uploads era gol la copiere; înaintea instalării este necesară copia finală cu scrierile oprite.
- Pornire izolată a imaginii candidate pe copia datelor, fără rețea și fără secrete: healthcheck 0; integritate SQLite ok; zero erori de chei externe. Rândurile și valorile existente users/firms/jobs/payments păstrate. Raport: `migration-preview/result.json` în directorul backup. Containerul de verificare este oprit. Nu s-au rulat plăți sau teste funcționale.

## Configurație pregătită

`docker-compose.production.yml` păstrează explicit volumele existente, adaugă verificarea sănătății și permite indexarea numai pentru producție. `.env` este furnizat de Coolify; se păstrează configurația live pentru MFA, email, AI și celelalte servicii. Nu se copiază configurația sandbox. Imaginea trebuie reconstruită: Next.js compilează valorile NEXT_PUBLIC; Dockerfile acceptă acum cele două argumente publice, fără secrete la build.

## Blocaje constatate, înainte de schimbarea traficului

1. `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` lipsește din configurația live. Trebuie cheia `pk_live_…` a contului NITIDO `acct_1UE6FS51kyjRFxgu`.
2. `STRIPE_CONNECT_WEBHOOK_SECRET` lipsește. În contul Stripe live există doar endpointul platformei `we_1UE7sQ51kyjRFxgukmmJa1nF`, URL `/api/stripe/webhook`. Nu există endpointul `/api/stripe/connect-webhook` pentru conturile conectate: `account.updated`, `payout.paid`, `payout.failed`. Secretul trebuie distinct de cel al platformei. Connectorul a returnat numai operații GET pentru căutarea endpointurilor, inclusiv căutarea de creare; crearea nu a fost executată.
3. La configurarea Stripe trebuie revizuită lista evenimentelor platformei conform handlerului candidat; lista live observată este charge.succeeded, charge.refunded, payment_intent.payment_failed, charge.dispute.created, charge.dispute.closed.

Nu s-au schimbat sursa, configurația activă, imaginea sau traficul producției. Nu s-au activat transferuri live, modificat conturi ori creat plăți. Lipsa recovery hashes nu invalidează TOTP-ul existent; nu este folosită ca blocaj suplimentar.

## Continuare

Completați cele două valori live în Coolify și endpointul Connect din Stripe. Verificați identitatea contului și modul live fără afișarea secretelor. Selectați candidatul revizuit și `/docker-compose.production.yml` în aplicația de producție; inspectați Compose rezultat pentru volume, domenii și păstrarea mediului. Efectuați backupul final și instalați. Confirmați healthcheck, HTTPS, pagină publică, indexare și rute private. Nu declarați publicarea efectuată înainte de confirmarea noii imagini pe nitido.ro.
