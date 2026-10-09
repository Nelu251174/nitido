# Cerere actualizare producție — 13 septembrie 2026

Candidat evaluat: `356fadeaa8eecf0797f73ba8c9b494a5dac69269`. Aprobarea beneficiarului este primită și nu trebuie repetată. Promovarea nu a fost executată; verdict tehnic NO-GO.

## Verificare directă pe server

Producția rulează `f3584d3dfc8a859f6780e2dff21e440d106a0456`, cu cheie Stripe live. Secretul TOTP admin și secretul webhookului platformei sunt prezente. Lipsesc `NITIDO_ADMIN_RECOVERY_HASHES` și `STRIPE_CONNECT_WEBHOOK_SECRET`. Lipsește și `NITIDO_STRIPE_PLATFORM_ACCOUNT_ID`, dar citirea codului confirmă că acesta este cerut de workerul financiar sandbox și nu constituie singur un blocaj de producție. Nu au fost afișate valorile cheilor. Prezența TOTP nu dovedește înrolarea și posesia factorului.

Sandboxul rulează candidatul actual și este healthy, cu cheie Stripe test și cele două secrete webhook configurate. TOTP admin și codurile de recuperare lipsesc. Nu au fost executate probele autentificate, challenge/device Stripe și reconcilierea completă.

## Backup și pornire izolată executate

- Copie SQLite nouă, realizată prin API backup fără oprirea producției: `/root/nitido-release-backups/20260913T115036Z/nitido.db`.
- SHA-256: `5fe4d1bb3654c9b75da10a6743abce557ec8520b211911f2333fa7760b8de299`.
- Integritate ok și zero erori foreign key.
- Copia a fost pornită cu imaginea exactă a candidatului, într-un container fără rețea și fără porturi publicate, cu seeding oprit și fără cheia Stripe runtime.
- Healthcheck trecut. Integritate ok, zero erori foreign key, numărul și amprenta conținutului tuturor celor 23 de tabele existente comparate rămân identice. Schema nouă poate adăuga tabele; acestea nu sunt numărate ca date istorice.
- Containerul temporar a fost eliminat, copia și raportul păstrate: `/root/nitido-restore-drills/20260913T115239Z/report.json`.
- Această probă nu include restaurare de fotografii sau copie off-site și nu închide integral gate-ul de infrastructură.

## Verdict și ordine de continuare

Evaluatorul existent `scripts/release-gate.mjs`, aplicat funcțional candidatului exact și fișierului `release-evidence-20260913-356fade.json`, păstrează șase gate-uri neînchise: configurație staging, ciclu Stripe sandbox, dispozitive fizice, dashboarduri autentificate, reconciliere financiară, restaurare integrală. CI și aprobarea beneficiarului sunt confirmate.

Ordinea necesară: configurare și înrolare autentificată admin; probe staging restante cu dovezi pe candidat; configurare live Connect aferentă contului live și verificarea recuperării admin; reevaluare gate; backup final și promovare; verificări după instalare. Nu se copiază secrete sandbox în producție și nu se etichetează trecerea CI ca acceptare funcțională.

E2 rămâne activă. E3–E5 nu sunt declarate începute sau acceptate ca urmare a unei promovări care nu a avut loc.
