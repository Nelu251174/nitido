# A2 — Durată evaluată și verificarea capacității

Continuă PR62. Livrare în cod pentru sandbox, fără deploy, schimbări Stripe, rezervări sau alocări externe.

## Problema rezolvată

Cererea complexă avea evaluare financiară și fotografii, dar nu păstra o estimare operațională explicită a duratei, deplasării și necesarului de echipe. Calendarul propus pentru ofertele simple nu înlocuiește această evaluare. Verificarea informativă din catalog și preluarea unei lucrări au reguli diferite: acceptJobAtomic folosește regula conservatoare de suprapunere la nivel de firmă, inclusiv minimele echipei alocate.

## Comportament

În Admin, în calculul intern al cererii, noua secțiune permite introducerea începutului, duratei de lucru, rezervei de deplasare după lucrare și numărului de echipe necesare din aceeași firmă. Durata și echipele nu au valori implicite. Deplasarea zero trebuie completată explicit. Sursa estimării și motivul sunt obligatorii. Limita duratei de 10080 minute urmează limita tehnică a catalogului; nu este o promisiune comercială.

Categoria și localitatea se citesc din cererea salvată, nu din date trimise de browser. La salvare se verifică asocierea firmei la categorie, localitatea, verificarea firmei, suspendările și echipele active. Pentru fiecare echipă, intervalul se extinde folosind maximul dintre durata evaluată și durata minimă a echipei, plus maximul dintre deplasarea evaluată și cea configurată a echipei.

Se reutilizează firmAvailabilityError pentru suprapunerile firmei. Astfel, o echipă aparent liberă nu face firma eligibilă dacă preluarea ar refuza-o din cauza altei lucrări. Se verifică și perioadele indisponibile ale echipei. Intervalele neconfirmate sau invalide blochează disponibilitatea; nu sunt tratate drept timp liber. Limitele adiacente sunt permise, perioadele anulate sunt ignorate.

Planul se poate salva și când nu există capacitate suficientă. Rezultatul arată explicit zero firme eligibile și motivele; nu reprezintă aprobare de alocare. Necesarul de echipe se verifică în interiorul aceleiași firme, fără combinarea automată a unor prestatori independenți.

## Istoric și autorizare

Tabela assessment_plans păstrează revizii imutabile, versiunea cererii, parametrii, fotografia capacității la momentul verificării, identitatea Admin și data. Scrierea și auditul Admin sunt atomice. O cerere schimbată, închisă sau o revizie concurentă este respinsă. Identitatea operatorului vine din sesiunea verificată.

API-ul /api/admin/assessment-plans este exclusiv Admin, cu verificarea originii, limită de dimensiune și răspunsuri private/no-store. Clientul și firma nu primesc planul sau motivele interne. Mutațiile sunt disponibile numai cu flagul existent NITIDO_MANUAL_OFFERS_SANDBOX, domeniul sandbox exact și fără chei live sk_live_/rk_live_. Nu a fost schimbată configurația serverului.

Istoricul este prezentat ca verificare făcută la o anumită dată, nu ca disponibilitate curentă garantată. O nouă salvare recalculează capacitatea. Schimbarea versiunii cererii este marcată la actualizarea interfeței.

## Limite și următoarea legătură

Planul nu modifică durata unei oferte deja acceptate, nu rezervă echipe, nu generează lucrare și nu pornește plata. Renovările și suprafețele mari pot fi evaluate operațional, dar nu sunt încă activate în rezervarea automată. Verificarea fotografiilor rămâne obligatorie la publicarea ofertelor de renovare.

Modelul actual de execuție are o alocare de echipă pe lucrare și o regulă conservatoare de disponibilitate pe firmă. Cerințele cu mai multe echipe sunt înregistrate pentru planificare; acest pachet nu pretinde execuție cu mai multe echipe. Intervalul evaluat este continuu: nu se inventează ture, program de lucru sau disponibilitate nocturnă.

Următorul pas este legarea unei revizii operaționale reconfirmate de ofertă și de rezervarea asistată, cu rezervarea atomică a capacității și respectarea modelului de execuție. Această etapă nu este acoperită prin simpla existență a evaluării.

## Validare și revenire

26 teste noi prin endpointurile reale și SQLite verifică evaluarea renovării/suprafeței mari, minimele și deplasarea, suprapuneri între echipele firmei, intervale neconfirmate, eligibilitate, cerințe lipsă, revizii concurente, istoricul capacității, acces Admin, CSRF și rollback la eșecul auditului. Suita A2 include 500 teste în 38 fișiere. Se rulează în UTC și Europe/Bucharest, plus Next typegen, TypeScript și ESLint țintit.

Verificarea vizuală în sandbox rămâne restantă din cauza blocajului de acces deja documentat. Nu se declară validare pe dispozitive sau publicare în TestFlight/Google Play. PR62 avea CI verde înaintea acestei etape.

Revenirea păstrează tabela și istoricul; dezactivarea mutațiilor sandbox oprește salvări noi. Nicio comandă sau alocare nu este modificată de plan. Se păstrează cerințele de rollback ale PR61/PR62 pentru fotografii și propunerile de programare.
