# Webhook Stripe Connect separat

Endpoint: `POST /api/stripe/connect-webhook`. Configurați în contul Stripe corespunzător mediului un endpoint pentru **connected accounts**, cu `connect=true`, evenimentele `account.updated`, `payout.paid`, `payout.failed` și versiunea API `2026-07-29.dahlia` (aceeași versiune explicită folosită pentru endpointul platformei în sandbox).

Salvați secretul acelui endpoint în `STRIPE_CONNECT_WEBHOOK_SECRET`, disponibil doar la runtime, apoi redeploy. Secretul trebuie să difere de `STRIPE_WEBHOOK_SECRET`. Endpointul platformei `/api/stripe/webhook` păstrează propria configurație.

Ruta Connect verifică semnătura pe corpul brut, modul test/live corespunzător cheii instalate, identificatorul contului conectat și tipul obiectului. Evenimentele platformei și semnăturile celuilalt endpoint sunt respinse. Lipsa configurației produce 503, semnătura sau contextul invalid 400, iar eșecul procesării 500 pentru a permite retry. Răspunsurile nu expun detalii de la furnizor.

Procesorul comun păstrează inboxul durabil și deduplicarea. Pentru payout citește starea Stripe în contextul contului firmei și înregistrează payoutul bancar separat; un payout nu marchează automat lucrările ca plătite. Un cont fără corespondent local cere investigare, nu validează reconcilierea.

## Dovezi și acceptare

Testele rutei folosesc semnături generate și verificate de SDK-ul Stripe real, cu procesorul izolat; testele existente ale procesorului verifică separat persistența și contextul contului. Preflight-ul respinge un secret Connect lipsă, demonstrativ sau identic cu secretul platformei.

Pentru închiderea gate-ului în staging sunt necesare suplimentar: endpoint Connect confirmat în contul de test corect, secret instalat, candidat identificat prin SHA/imagine, livrare reală de la Stripe pentru o firmă de test cunoscută și corelarea event/account/payout cu inboxul și registrul local. Retry-ul aceleiași livrări nu trebuie să dubleze efectele. POST-urile nesemnate respinse și testele unitare nu înlocuiesc această probă financiară.

Nu se activează transferurile reale prin simpla configurare a webhookului. Promovarea în producție rămâne condiționată de restanțele din release gate.
