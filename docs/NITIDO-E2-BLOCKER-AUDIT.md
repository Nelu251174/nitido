# E2 — verificarea blocajelor externe, 13 septembrie 2026

## Conturi și configurație verificate prin Stripe

Conectorul expune NITIDO live `acct_1UE6FS51kyjRFxgu`, același cont în test și sandboxul separat `acct_1UE6GE8ARvpRkNS9`. Nu se confundă modul test al contului live cu sandboxul instalat.

Citirea completă a endpointurilor live (has_more=false) returnează un singur endpoint activ: `we_1UE7sQ51kyjRFxgukmmJa1nF`, URL `https://nitido.ro/api/stripe/webhook`, versiune API `2026-08-26.dahlia`. Evenimente: charge.succeeded, charge.refunded, payment_intent.payment_failed, charge.dispute.created, charge.dispute.closed. Endpointul Connect nou nu există în lista live. Extinderea evenimentelor platformei trebuie pregătită pentru noul handler, nu aplicată orbește versiunii vechi.

Sandboxul separat nu conține PaymentIntent-uri la această citire (data=[], has_more=false). Acest rezultat nu închide proba ciclului de plată.

## Limită de operare constatată

Căutările de operații de creare PaymentIntent, creare webhook și retrimitere eveniment nu au expus operații de scriere aplicabile; au returnat GET sau rezultate nerelevante. Aceasta dovedește lipsa operațiilor necesare în suprafața disponibilă, nu demonstrează singură cauza sau un anumit set OAuth. Următorul pas este verificarea autorizării sesiunii Stripe prin mecanismul furnizorului. Nu s-a încercat evitarea acestei limite prin browserul Stripe sau acces direct cu altă cheie.

## Clarificare a raportului anterior

`NITIDO_STRIPE_PLATFORM_ACCOUNT_ID` este folosit de workerul financiar exclusiv sandbox (`financialRecovery.ts`). Nu este cerut de handlerul Connect live. Lipsa lui în producție nu trebuie contabilizată ca blocaj independent. Recuperarea admin poate lipsi fără a invalida un TOTP configurat, dar proba de recuperare cerută de release rămâne neîndeplinită.

## Ce mai înseamnă E2

Șase gate-uri sunt încă neînchise: configurație staging, ciclu Stripe sandbox, dispozitive fizice, dashboarduri autentificate, reconciliere financiară, restaurare completă. Acestea sunt condiții de acceptare și conțin mai multe scenarii; nu sunt șase mici modificări de cod. Backupul și pornirea izolată pe candidatul curent sunt demonstrate separat, dar restaurarea foto și off-site rămân deschise. Inventarul integral al nucleului din brief nu este închis automat de aceste gate-uri. Nu există bază pentru un procent sau o dată fermă de finalizare.

Nu s-au executat plăți, rambursări, transferuri sau schimbări de configurație Stripe live prin acest audit.
