# Integrare și lansare — candidat consolidat

## Puncte de integrare Stripe

Pachetul nu schimbă `payments`, autorizarea/capturarea, webhookurile, Connect, transferurile sau payouturile. Modulele existente rămân `payments.ts`, `authorizationAttempts.ts`, `paymentCancellation.ts`, `paymentConfirmation.ts`, `stripeInbox.ts` și rutele lor. Referințele de plată din fișa clientului sunt numai de citire; costul de procesare din calculul marjei trebuie documentat, nu presupus din suma capturată.

Oferta acceptată păstrează propriul snapshot. Motorul administrabil nu recalculează tacit o comandă istorică înainte de plată. Schimbările de etichete, severitate sau termene nu inițiază operațiuni financiare. Testele de plată rulează cu integrări simulate; nu certifică 3DS, webhook, refund sau reconciliere în contul real.

Nu copia secrete din producție în sandbox. Nu activa chei live, Connect sau abonament Pro ca efect secundar al acestui upgrade. Regulile comerciale/fiscale și configurarea efectivă se verifică separat, conform amendamentelor brief-ului și `../NITIDO-RELEASE-GATE.md`.

## Pregătirea sandbox-ului

1. Folosește ramura `feat/nitido-crm-checklist-controls` și SHA-ul exact al PR-ului. Ea include părinții upgrade-ului; nu înlocui doar un fișier dintr-un pachet intermediar. Confirmă rezultatul CI pe același SHA.
2. Identifică în Coolify aplicația **sandbox**, volumele ei și versiunea anterioară. Fă o copie coerentă și verifică restaurarea izolată conform `BACKUP-RESTORE.md` înainte de migrare. Backupul producției nu se deduce din cel al sandbox-ului sau invers.
3. Păstrează separarea test/live și configurarea MFA. Activările deja existente sunt `NITIDO_MANAGED_PRICING_SANDBOX=true` și `NITIDO_MANUAL_OFFERS_SANDBOX=true`, numai împreună cu `NEXT_PUBLIC_SITE_URL=https://sandbox.nitido.ro` și fără secret Stripe live. Nu se înlocuiesc automat variabilele existente.
4. Folosește migrarea Pro existentă numai conform stării bazei țintă. Refuzul tabelelor legacy nu se ocolește cu DROP. Inițializarea Marketplace adaugă schema acestui pachet; noile tabele nu cer copierea datelor clienților în altă bază.
5. După deploy verifică sănătatea containerului, SHA-ul servit și scenariile din `CONSOLIDATED-QA.md`. Verde/Success la build nu închide acceptanța funcțională.

Adresele funcționale după publicarea efectivă în sandbox sunt pagina principală, `/admin#performanta`, `/admin#clienti`, `/admin#incidente`, `/admin#catalog` (checklisturi), plus rutele Standard/Express/Pro existente. Aceste căi nu sunt dovada că noul commit este deja publicat.

## Promovare

Se promovează același candidat verificat, păstrând datele și configurațiile specifice mediului. Nu se folosește workflow-ul de deploy de producție pentru a testa branch-ul. `deploy.yml` și ramura lui existentă nu sunt schimbate în acest pachet.

Aprobarea utilizatorului pentru executarea brief-ului există; nu este necesară repetarea ei pentru fiecare corecție. Totuși, nu se marchează drept PASS verificări neefectuate și nu se activează valori comerciale neaprobate. Condițiile tehnice deschise sunt cele din matricea brief-ului și poarta de lansare existentă. Dacă mediul nu poate fi accesat, starea este **neverificat**, nu „publicat cu succes”.

## Mobil

NITIDO folosește aplicația Capacitor existentă. Un update web nu dovedește încărcarea unui build nou în TestFlight sau Google Play. Folosește `../NITIDO-TESTFLIGHT-UPDATE.md` și ghidurile existente pentru App Store/Google Play; înregistrează separat numărul buildului, procesarea, grupul de testare și distribuția. Nu s-a efectuat această distribuție în pachetul curent.

## Acces și handover

Codul, testele, schema, scriptul și documentele sunt în `Nelu251174/nitido`, în ramura candidatului. Ownerul are nevoie de acces verificat la GitHub, Coolify/host, volume/backupuri, DNS, email, analytics și conturile Apple/Google relevante. Nu se pot deduce drepturile dintr-o captură sau din existența unui link. Nu sunt publicate credențiale în documente sau în commit.

În sesiunea de implementare nu a fost disponibil acces operabil la Coolify și parcurgerea sandbox prin browser a fost blocată de politica instrumentului. Acea restricție nu a fost ocolită prin alt client. Nu a fost confirmată disponibilitatea unui nou build în magazine. Aceste limite explică lipsa dovezilor live, dar nu înlocuiesc lista lipsurilor de implementare din `BRIEF-EXECUTION-STATUS.md`.
