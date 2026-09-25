# CRM și liste de execuție — 25.09.2026

Candidat: `feat/nitido-crm-checklist-controls`, continuare a PR #82 (`feat/nitido-upgrade-consolidation`). Aceste modificări sunt cod pentru verificare; documentul nu afirmă publicarea în sandbox, producție sau magazine mobile.

## Restricții explicite ale clientului

În `/admin#clienti`, administratorul cu sesiune MFA verificată poate bloca independent rezervările noi sau cererile noi de evaluare. Debifarea și salvarea ridică restricția aleasă. Orice schimbare cere motiv, revizia curentă și înregistrează autorul verificat și data. Istoricul este imuabil și paginat. Dacă scrierea auditului eșuează, restricția nu se aplică parțial.

Controlul rezervării se execută în aceeași tranzacție SQLite IMMEDIATE cu crearea lucrării, după verificarea replay-urilor și înainte de consumarea creditului. Acoperă ruta comună Standard, Express, ofertele manuale/asistate și rezervările Host prin aceeași rută. Generatorul recurent verifică separat clientul în tranzacția fiecărei serii; o serie blocată este raportată în rezultatul generatorului fără avansarea cursorului și fără a împiedica celelalte serii. După ridicarea restricției, se aplică regulile existente privind datele eligibile, nu se recreează vizite în trecut.

Crearea evaluărilor are propriul control tranzacțional. Repetarea unei cereri deja create, corespondența și anularea evaluării existente sunt păstrate. Restricția nu este o suspendare a autentificării: lucrările existente, mesageria, sesizările, plățile și recuperările/remedierile operaționale nu sunt anulate. Planurile recurente pot fi administrate în continuare; generarea rezervărilor noi este blocată. Organizațiile Pro au un model de autorizare separat și nu sunt blocate prin această fișă Marketplace.

Etichetele rămân clasificări: scrierea cuvântului „blocat” într-o etichetă nu activează controlul. Nu există scor antifraudă sau penalizare automată. Motivele interne nu sunt trimise clientului în răspunsul de refuz.

## Valoarea relației cu clientul

Fișa citește întreaga relație într-o tranzacție coerentă, independent de pagina de istoric selectată. Afișează numărul lucrărilor, lucrările finalizate și suma prețurilor brute ale serviciilor finalizate, în RON. Această sumă nu este încasarea netă după credit/rambursare și nu reprezintă venit fiscal.

Marja reutilizează regulile `operationalMargin` și ultima revizie a costurilor fiecărei lucrări finalizate. Se afișează separat subtotalul confirmat, numărul lucrărilor cu estimări și cele cu costuri lipsă/incomplete. Totalul rămâne necunoscut până când fiecare lucrare finalizată are costuri confirmate. Pierderile confirmate rămân negative. Nu se estimează costuri Stripe, TVA sau profit net. Costurile efective pot fi înregistrate în prezent prin fluxul ofertelor asistate; lipsa lor pe alte lucrări rămâne vizibilă, nu este completată cu zero.

## Checklisturi administrabile

În `/admin#catalog`, sub catalogul de servicii, editorul oferă liste pentru rezervările Standard și Express și pentru cele șase categorii de evaluare: întreținere, generală, renovare, mutare, birouri, proprietăți turistice. Publicarea cere un motiv și revizia curentă; lista are 1–40 de sarcini, coduri unice și descrieri. Autorul vine din sesiunea verificată, iar auditul și publicarea sunt atomice. Suprafața editorului este crem.

Fiecare lucrare nouă păstrează o copie a listei și a reviziei la creare. O ofertă asistată folosește categoria evaluării originale, nu o categorie trimisă arbitrar de client. Recurența folosește lista Standard. Repostările, recuperările și revenirile gratuite moștenesc lista lucrării de origine. Crearea și snapshotul sunt în aceeași tranzacție; o eroare nu lasă o lucrare fără regulile sale.

Lucrările istorice fără snapshot folosesc exclusiv lista inițială de șase sarcini. Publicarea unei liste nu modifică aceste lucrări și nici copiile deja salvate. Clientul, firma, echipa și formularul de sesizare citesc aceeași listă autorizată. Raportul arhivează descrierile și bifările corespunzătoare lucrării. Pentru listele publicate în editor (revizie > 0), finalizarea verifică și pe server sarcinile și dosarele de sarcini nesoluționate. Comportamentul istoric de finalizare pentru revizia inițială rămâne compatibil.

Nu sunt introduse alte condiții foto: fotografiile de sosire/final și autorizarea lor rămân cele existente. Editorul nu configurează checklisturile Pro pe proprietate; acest punct din §11 rămâne distinct, la fel ca regulile foto diferențiate pe serviciu.

## Verificare în sandbox după deploy

1. Publică o listă Standard cu două sarcini identificabile; creează o rezervare nouă și verifică aceeași listă în conturile autorizate. Un alt client nu trebuie să primească lista acelei lucrări.
2. Publică o revizie diferită și verifică păstrarea listei primei rezervări. Verifică și o lucrare veche fără snapshot.
3. Raportează o sarcină nerealizabilă; verifică motivul, blocarea bifării cât timp dosarul e deschis, raportul și finalizarea.
4. Aplică restricția numai rezervărilor; confirmă refuzul fără credit consumat și accesul la istoricul existent. Verifică independent restricția evaluărilor și ridicarea ambelor.
5. Pentru recurență, verifică cursorul seriei blocate și o serie a altui client, fără executarea plăților reale.
6. Compară totalurile CRM cu lucrările/costurile din mediul de test; confirmă că marja incompletă nu apare drept zero sau profit net.
7. Parcurge editorul și cardurile pe mobil, cu texte lungi; confirmă suprafețele crem și lipsa depășirilor laterale. Testele automate nu înlocuiesc această probă vizuală.
