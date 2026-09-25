# A2 — Praguri și excepții de marjă pentru ofertele manuale

Continuare PR58, pregătită pentru sandbox. Nicio modificare de producție, de variabile server sau de integrare Stripe.

## Ce rezolvă

Până la această etapă, calculul marjei nu avea un prag comercial configurat. Publicarea cere acum o regulă explicită, iar o ofertă sub prag cere o justificare distinctă față de motivul obișnuit al publicării.

Admin poate configura o marjă minimă în bani, în puncte de bază sau ambele. 100 bani = 1 leu; 100 puncte de bază = 1%. Gol înseamnă neconfigurat pentru acel criteriu; zero este o alegere explicită. Nu se poate salva o regulă cu ambele criterii goale. Nu se introduce automat un procent comercial.

Când sunt configurate ambele criterii, ambele trebuie respectate. Egalitatea cu pragul este permisă. Compararea procentuală se face prin produse întregi, înainte de rotunjirea pentru afișare. Venitul clientului zero face pragul procentual neverificabil și blochează publicarea. Costurile necunoscute nu pot fi acoperite prin justificare.

## Operare

1. Deschide Admin, Controlul marjei ofertelor manuale.
2. Completează pragurile aprobate comercial și motivul configurării. Salvează regula.
3. În cererea de evaluare, salvează calculul intern și actualizează ofertele pentru a încărca regula curentă.
4. La ofertă sub prag apare alerta. Completează Justificarea excepției sub prag înainte de publicare.
5. Verifică raportul Oferte publicate sub prag. Afișează ultimele 200 de excepții, cu suma, motivul, versiunea regulii și starea ofertei.

Regulile au versiuni imuabile și operator derivat din sesiunea Admin verificată. Editările concurente sunt respinse. O regulă schimbată după afișare obligă operatorul să reîncarce înainte de o publicare nouă.

Fiecare ofertă nou publicată păstrează decizia financiară internă: regula aplicată, marja, venitul clientului, caracterul estimat/confirmat al costurilor, existența excepției, justificarea, operatorul și momentul. Publicarea, evenimentul și decizia sunt atomice; un audit Admin eșuat anulează operațiunea. O republicare identică nu rescrie decizia istorică. Ofertele deja publicate înainte de această etapă nu primesc retroactiv o decizie fabricată.

Clientul nu primește aceste date interne. API-ul regulilor și raportului cere autentificare Admin verificată și nu permite cache. Mutațiile cer aceeași activare explicită sandbox ca publicarea ofertelor.

## Date și rollback

Se adaugă tabelele margin_policies și offer_margin_decisions, cu indecșii impliciți ai cheilor primare, chei externe și protecții împotriva rescrierii/ștergerii. Nu se șterg și nu se transformă date existente. La rollback de cod, tabelele și istoricul se păstrează; dezactivează întâi mutațiile ofertelor sandbox. O regulă greșită se corectează printr-o revizie nouă cu motiv, nu prin ștergere SQL.

## Validare

- 421 teste în 33 fișiere, trecute în UTC și Europe/Bucharest.
- Next typegen și TypeScript fără erori.
- ESLint pentru modulele și componentele noi/modificate, fără erori.
- PR58 avea GitHub Actions finalizat cu succes înainte de începerea acestei etape.
- Testele verifică praguri absolute/procentuale, limite, rotunjire, ownership, acces Admin, CSRF, activare sandbox, revizii concurente, justificări, confidențialitate și rollback.

## Limite rămase

Acest control se aplică ofertelor manuale, nu tuturor comenzilor Standard/Express/Pro. Raportul privește ofertele, nu comenzi plătite. Nu include încă filtrele comerciale complete sau reconcilierea marjei realizate după execuție.

Legătura dintre oferta acceptată și rezervare/plată rămâne de implementat. Auditul a identificat o diferență: src/lib/payments.ts folosește calcNetForFirm pe prețul brut, în timp ce calculul manual permite remunerare introdusă separat. Integrarea următoare trebuie să reconcilieze aceste valori și reducerile fără modificarea arhitecturii Stripe sau dublarea discountului.

Nu a fost efectuat deploy. Validarea vizuală desktop/mobil și E2E în sandbox rămâne blocată de restricția de acces a browserului, consemnată anterior. Nu este declarată finalizarea Definition of Done a brief-ului.
