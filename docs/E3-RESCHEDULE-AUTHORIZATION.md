# E3 — reautorizarea cardului pentru o vizită reprogramată

Această completare înlocuiește blocajul „contactează suportul” atunci când autorizarea unei rezervări preluate nu acoperă noul interval. Nu schimbă prețul rezervării, nu încasează plata și nu expune comisionul către firme.

## Comportament

1. Clientul propune o dată, iar firma confirmă intervalul disponibil.
2. Dacă autorizarea existentă acoperă noua durată, se păstrează fluxul existent de reprogramare.
3. Altfel, propunerea rămâne în așteptarea clientului. Data inițială rămâne valabilă. Clientul vede acțiunea „Confirmă cardul pentru noua dată”.
4. În cele 48 de ore dinaintea noii vizite, clientul vede suma și acceptă explicit o nouă autorizare pe cardul ales pentru rezervare, inclusiv posibilitatea a două sume rezervate temporar.
5. Procesatorul confirmă noua autorizare; serverul verifică identitatea, suma, metoda manuală și `capture_before` după sfârșitul lucrării. Reverifică și rezervarea, disponibilitatea firmei/echipei, deplasarea și bugetul proprietății.
6. În aceeași tranzacție se schimbă data, autorizarea curentă și starea propunerii. Numărul plăților curente pentru rezervare rămâne unul. Identitatea apariției recurente nu se modifică.
7. Numai după acest pas este eliberată autorizarea veche. Dacă eliberarea nu este confirmată, interfața arată că este în curs; operația rămâne înregistrată pentru reluare.

Sesiunea de confirmare durează 30 de minute. Dacă banca refuză, clientul poate relua aceeași autorizare în sesiune. După expirare/retragere/refuz ori dacă rezervarea s-a schimbat, autorizarea nouă nefolosită este eliberată. Clientul poate retrage propunerea și crea una nouă. O sesiune abandonată nu schimbă automat data rezervării.

## Persistență și recuperare

- Migrare aditivă: `firm_confirmed_at`, `confirmed_snapshot` pe `job_reschedule_requests`; tabel nou `reschedule_authorizations`.
- Fiecare propunere păstrează separat vechea plată și vechea încercare de autorizare, parametrii noi, identitățile Stripe, acordul clientului și starea eliberării. Aceste date financiare nu sunt returnate de istoricul accesibil firmelor.
- Parametrii se persistă înaintea creării Stripe. Cheia de idempotentă este legată de propunere. Crearea nu confirmă cardul; secretul clientului nu se returnează înainte de persistarea identității Stripe. Un rezultat necunoscut al creării nu este recreat automat de cron.
- O autorizare veche cu eliberare neconfirmată blochează crearea unei noi înlocuiri pentru aceeași rezervare, evitând acumularea de autorizări.
- Recuperarea utilizează sarcina existentă `scripts/recurring-runner.mjs`, la fiecare cinci minute. Prelucrează cel mult cinci eliberări eligibile, cu timeout Stripe de trei secunde și backoff persistent. Nu creează autorizări, încasări, transferuri sau rambursări.
- Runnerul raportează erorile de eliberare. Operațiile rămân înregistrate și după repornirea containerului.
- Retragerea/refuzul încearcă imediat eliberarea autorizării noi nefolosite; la întrerupere rămâne recuperarea programată.
- Anularea curentă și evenimentele Stripe folosesc identitatea exactă a autorizării; evenimentele vechi nu modifică noua plată prin simpla potrivire a rezervării.

## Livrare și limite

- Compilare de producție: `npm run build` (Next.js și TypeScript).
- Nu s-au rulat suite de teste, scenarii manuale de plată sau QA, conform instrucțiunii beneficiarului. Compilarea nu este o verificare bancară.
- Instalarea vizează aplicația sandbox existentă din Coolify. Această modificare nu reprezintă publicare în App Store/Google Play și nu necesită un nou pachet nativ pentru wrapperul care încarcă sandbox-ul.
- Pentru o dată la peste 48 de ore, interfața arată momentul de la care clientul poate confirma; data veche rămâne valabilă până la finalizarea reprogramării.
- Livrarea acestei ramuri nu constituie acceptarea integrală a tuturor cerințelor E3/E4/E5 din brief.

Referințe tehnice: [termenul efectiv al autorizării Stripe](https://docs.stripe.com/payments/place-a-hold-on-a-payment-method), [idempotentă Stripe](https://docs.stripe.com/api/idempotent_requests).
