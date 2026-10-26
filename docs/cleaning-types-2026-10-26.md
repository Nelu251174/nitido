# Tipuri de curățenie și campanii — 26.10.2026

Tipul curățeniei este separat de tipul spațiului și de modul Standard / Express. Grila revizuită anterior devine grila pentru curățenie generală; întreținerea are tarif și conținut distinct, iar după constructor / renovare se solicită evaluare și ofertă confirmată.

| Componentă | Întreținere | Generală |
| --- | ---: | ---: |
| Apartament până la 40 m² | 400 lei | 750 lei |
| Apartament până la 60 m² | 550 lei | 1.000 lei |
| Apartament până la 80 m² | 700 lei | 1.200 lei |
| Apartament până la 100 m² | 850 lei | 1.450 lei |
| Fiecare m² peste 100 | 8,50 lei | 14,50 lei |
| Casă, lei/m²; minimum | 8; 400 lei | 14; 700 lei |
| Birou, lei/m²; minimum | 6; 300 lei | 10; 500 lei |
| Alt spațiu, lei/m²; minimum | 7; 350 lei | 12; 600 lei |
| Geamuri, m² fizic o singură dată | 12 lei | 12 lei |
| Fiecare baie după prima | 100 lei | 100 lei |

Acestea sunt tarifele comerciale NITIDO. Întreținerea este o intervenție pentru murdărie ușoară în spații curățate regulat, nu o reducere a aceluiași pachet general. Comparatoarele publice pentru întreținere, generală și renovare sunt documentate separat în [auditul tarifelor](pricing-2026-10-26.md); nu se pretinde o medie națională omogenă. Nu există reducere automată pentru simplul fapt că se creează o serie recurentă.

## Operațiuni și evaluare

Întreținere: ștergere praf pe suprafețe accesibile, aspirare și spălare pardoseli, întreținere ușoară a unei băi și a unei bucătării, golirea coșurilor menajere și verificare finală.

Generală: operațiunile detaliate ale pachetului, inclusiv fronturi exterioare, plinte accesibile, întrerupătoare și mânere, o baie și o bucătărie. Geamurile și băile suplimentare se selectează separat. Nu promitem interiorul electrocasnicelor, murdărie persistentă sau tratarea unor materiale speciale în prețul automat.

După constructor / renovare: se păstrează localitatea, suprafața și categoria la deschiderea evaluării și la întoarcerea prin autentificarea existentă. Clientul descrie praful, urmele de vopsea/ciment/adeziv, accesul și eventualele deșeuri; dovezile pot fi adăugate în traseul existent de evaluare. Oferta și programarea se confirmă separat. Nu se afișează un total automat și nu se creează rezervare sau plată prin alegerea acestui tip.

## Persistență și compatibilitate

- Versiunea tarifului: `nitido-2026-10-26-cleaning-types-v3`; condițiile noi: `nitido-booking-terms-2026-10-26-v5`.
- Tipul se transferă din configurator, se păstrează în draftul aceleiași file și este verificat din nou pe server. Prețul clientului nu este acceptat ca sursă a tarifului.
- Cererile automate pentru renovare sunt respinse cu direcționare către evaluare. Tipurile necunoscute sunt respinse. Un total sau o versiune anterioară explicită cere reconfirmare.
- Lucrările noi păstrează `cleaning_type` și snapshotul tarifului și conținutului. Firma vede tipul serviciului; suma netă se calculează prin politica existentă.
- Seriile noi pot selecta întreținere sau generală. Tipul este păstrat la generarea vizitelor. Lucrările deja generate și snapshoturile istorice nu sunt rescrise. Coloanele noi sunt nullable, fără presupunerea tipului unor lucrări istorice.
- Configurațiile administrabile rămân sub verificarea existentă de sandbox. Întreținerea nu folosește automat un tarif administrabil configurat numai pentru generală. Fluxurile cu interval de firmă, aprobare de buget sau pregătire turistică au condiții specifice; schimbarea lor în întreținere cere evaluare, fără aplicarea în tăcere a altui serviciu.
- Șabloanele operaționale configurate și ofertele manuale existente sunt păstrate. Listele noi de pachet se aplică explicit fluxului automat care le selectează.

## Campanii

Trei mesaje profesionale distincte, de aproximativ 270–300 de cuvinte, pentru clienți business, firme de curățenie și persoane fizice. Variantele A/B schimbă subiectul, păstrând corpul pentru comparație. Textele descriu alegerea serviciului, costurile, evaluarea și pașii următori, fără reduceri, disponibilitate imediată, volum de comenzi sau venit garantat.

Actualizarea operațională vizează ciornele generate cunoscute, cu verificarea conținutului anterior și citirea rezultatului. Textele modificate manual sau campaniile în altă stare se păstrează. Nu se schimbă contactele, acordurile, destinatarii sau livrarea; nu se creează trimiteri email.
