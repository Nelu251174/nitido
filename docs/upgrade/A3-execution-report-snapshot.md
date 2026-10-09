# A3 — Raportul de execuție păstrează dovezile trimise

## Problema și rezultatul

Raportul existent păstra autorul, nota și momentul, dar lista de verificări și fotografiile se citeau separat din starea curentă. O retrimitere cu altă notă era ignorată prin ON CONFLICT DO NOTHING, deși producea încă un eveniment de audit și un răspuns de succes.

Acest pachet extinde raportul existent cu o copie de referință a checklistului (chei, etichete și rezultat) și fotografiilor validate de sosire/finalizare ale firmei alocate (id, tip, moment de validare). Raportul, copia și auditul sunt salvate într-o singură tranzacție IMMEDIATE. O eroare la oricare dintre ele anulează întreaga trimitere.

Aceeași notă normalizată, retrimisă de același autor încă autorizat, nu produce raport sau audit suplimentar. Altă notă ori alt autor primesc 409 și instrucțiunea de reîncărcare. Un raport nou poate fi creat numai în starea arrived; după completed este permisă doar recunoașterea unei retrimiteri identice a unui raport deja existent. Revocarea accesului se verifică și pentru reîncercări.

## Persistență și compatibilitate

Tabela aditivă workspace_execution_evidence se leagă de raport prin job_id. Triggerele protejează copia și raportul asociat împotriva editării/ștergerii. Rapoartele vechi sunt păstrate fără o copie reconstruită din prezent. Inițializarea repetată nu inventează dovezi istorice.

Nu sunt copiate fișierele binare și nu este introdus un hash al conținutului foto; se păstrează referințe și metadate. Un fișier șters sau devenit inaccesibil nu este recuperat automat. Protecția accesului la fotografie rămâne în ruta privată existentă. API-ul de colaborare livrează copia numai după selecția lucrărilor autorizate, fără câmpuri financiare sau identificatori de plată.

## Interfață

În cardul echipei, sub Raport trimis, secțiunea Conținutul păstrat la trimitere arată verificările și legăturile către dovezile foto. Raportul vechi este etichetat explicit fără copie istorică. Accesul la fișiere este verificat separat și această limitare este explicată în interfață.

Nu schimbă condițiile de finalizare ale lucrărilor istorice, Stripe, încasarea, scorul sau regulile comerciale. Nu finalizează lucrarea prin trimiterea raportului.

## Verificare și limite

10 teste noi pentru copia păstrată, filtrarea dovezilor, reîncercări, date diferite, autor diferit, acces revocat, raport istoric, persistență imuabilă, rollback la erori și păstrarea execuției/plății. Comanda: npm run test:upgrade:a3-reports. 584 teste / 44 fișiere trecute în UTC și Europe/Bucharest, incluzând regresiile etapelor precedente. Typegen, TypeScript și ESLint țintit verificate.

Pachet pregătit pentru sandbox, fără deploy LIVE sau build TestFlight/Google Play. Verificarea browserului și a dispozitivelor rămâne neefectuată: accesul browser la sandbox a fost blocat explicit anterior, fără ocolire. După deploy, verificarea vizuală se face în /echipa, pe o lucrare test alocată, cu raport trimis. Nu sunt create automat lucrări ori plăți reale.

A3 rămâne deschis până la validarea pe roluri/dispozitive, continuarea auditului eligibilității și verificarea backup/restaurare.
