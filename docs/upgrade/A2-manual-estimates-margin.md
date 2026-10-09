# A2 — Pregătirea ofertelor manuale și marja operațională

## Livrare

Extinde evaluările asistate existente în Admin. Fiecare cerere poate avea un calcul intern cu componente de preț, reducere suportată de platformă, remunerație prestator și costuri pentru materiale, deplasare, procesare, alte cheltuieli și ajustare fiscală documentată.

Costurile au sumă în bani/RON, sursă, dată și stare necunoscut/estimat/confirmat. Costurile directe identifică suportatorul și includerea în remunerația prestatorului. Necunoscut înseamnă `null`, niciodată zero implicit. O valoare confirmată de zero necesită sursă și dată.

Calculul folosește suma datorată de client după reducere, din care scade remunerația prestatorului și numai costurile separate suportate de platformă. Reducerea nu se scade din nou; costurile prestatorului nu se dublează. Exemplul normativ: 500 lei serviciu − 50 lei reducere − 410 lei prestator = 40 lei marjă. Nu este profit net contabil și nu se presupune o cotă fiscală.

O informație lipsă produce marjă incompletă, nu rezultat aparent definitiv. Costurile estimate produc rezultat estimat; valorile declarate confirmate rămân distincte. Procentele au ca bază suma datorată de client; pentru zero, procentul nu este calculat. Nu există prag comercial implicit și nu se emite aprobare automată.

## Trasabilitate și acces

- Salvare exclusiv în Admin, cu MFA validat și origine verificată.
- Operatorul este referința sesiunii administrative autentificate, derivată pe server; nu este un nume furnizat de client și nu pretinde identificarea unei persoane dincolo de modelul Admin existent.
- Fiecare revizie păstrează motivul, momentul, datele financiare și versiunea cererii evaluate.
- Reviziile sunt append-only. Modificările SQL și ștergerile sunt blocate prin triggere.
- Revizia stale și schimbarea datelor cererii sunt respinse. Cererile anulate/refuzate nu pot primi calcule noi.
- Inserarea și auditul administrativ sunt în aceeași tranzacție. Dacă auditul eșuează, nu rămâne o revizie salvată.
- API-ul clientului nu primește marja sau costurile interne. Salvarea nu transmite o ofertă clientului și nu creează rezervare sau plată.

## Validare

`npm run test:upgrade:a2`: 375 teste / 29 fișiere trec în UTC și Europe/Bucharest. Include regresia A0/A1, 33 teste noi pentru marjă/revizii/API și verificările existente ale evaluărilor și MFA. TypeScript și lint pe fișierele modificate trec.

Verificări noi: exemplul financiar din brief, costuri incluse fără dublare, rezultat negativ, informații lipsă, cost estimat, bază procentuală zero, validarea sumelor/surselor, concurență, istoric nemodificabil, rollback la eșec audit, origine, acces și operator falsificat.

## Restanțe, fără acceptanță implicită

Aceasta este pregătirea internă A2, nu închiderea etapei complete. Rămân: transmiterea și acceptarea ofertei manuale de client, atașamentele/fotografiile obligatorii pentru post-constructor, integrarea în comandă cu regulile categoriei, comparația estimat–realizat pe lucrare, pragurile aprobate și excepțiile auditate, raportarea agregată.

Pragurile comerciale și tratamentul fiscal necesită valori aprobate; nu au fost inventate. Accesul browserului la sandbox a fost blocat anterior de politica browserului. Interfața și scenariile pe roluri/mobile nu au fost validate vizual aici. Nu s-au schimbat variabile de server și nu s-a făcut deploy LIVE sau distribuție mobilă.
