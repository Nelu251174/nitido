# A4 — Calendar Pro, reprogramare și aprobări

## Modificări

- Prima apariție recurentă este verificată ca moment efectiv: o oră deja trecută în ziua curentă nu mai este acceptată.
- Limita de generare folosește ziua civilă Europe/Bucharest, inclusiv în intervalul în care data UTC diferă de cea locală.
- Datele/orele civile inexistente sunt erori de validare Pro. O apariție viitoare care cade în ora lipsă de primăvară este marcată pentru verificare; alte vizite valide continuă. Erorile tehnice de stocare păstrează rollback-ul introdus anterior.
- Filtrele de costuri resping date imposibile și perioade inversate.
- Auditul reprogramării păstrează începutul și sfârșitul anterior, împreună cu noul interval.

## Scenarii verificate

Ora trecută astăzi; dată imposibilă; ora de vară lipsă; continuarea regulii după apariția DST; limita de generare la miezul nopții în România; recurență lunară 31 ianuarie → 28 februarie → 31 martie; reprogramare cu aceeași identitate a apariției, fără regenerare și cu respingerea reviziei vechi; perioade de raport invalide; rollback al aprobării și reprogramării dacă auditul eșuează; respingerea unui interval ocupat.

Tema crem și implementările precedente sunt incluse. Nu se schimbă Stripe, pragurile comerciale sau sumele aprobate. Nu se activează noi frecvențe recurente.

## Limite de livrare

Această etapă pregătește pilotul prin verificări de cod și integrare; nu dovedește desfășurarea pilotului cu portofolii reale. Validarea vizuală sandbox, iOS/Android, backup/restaurare și publicarea rămân distincte. Nu s-a publicat LIVE și nu s-a distribuit un build mobil.

Validare finală: 620 teste în 45 fișiere trecute în UTC și Europe/Bucharest, inclusiv 11 scenarii noi. TypeScript și git diff --check trecute. Comanda: npm run test:upgrade:a3-reports.
