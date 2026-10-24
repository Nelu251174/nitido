# Recuperare parolă ADMIN — sandbox

În pagina `/admin`, legătura **Ai uitat parola ADMIN?** deschide `/admin/recuperare`. Administratorul introduce emailul contului. Dacă există un cont ADMIN activ și configurat, serviciul tranzacțional existent primește cererea de email cu un link de unică folosință, valabil 15 minute. Răspunsul nu dezvăluie existența contului sau acceptarea/livrarea emailului. Lipsa configurării serviciului se raportează uniform, fără emiterea unui link.

Linkul este în fragmentul URL, pentru a nu ajunge în cererile HTTP și jurnalele serverului. Pagina îl elimină din adresă și cere parola nouă, confirmarea și un cod TOTP sau un cod de recuperare 2FA. Nu cere parola veche. MFA rămâne configurat și obligatoriu. Persoanele fără acces la email ori la factorul 2FA necesită recuperare prin infrastructură.

Parola are minimum 12 caractere, litere și cifre, maximum 72 de octeți UTF-8. Se stochează exclusiv hash bcrypt cu cost 12. Hashul nou, consumarea linkului și a factorului 2FA, invalidarea sesiunilor și auditul se salvează în aceeași tranzacție. După resetare se cere autentificare cu parola nouă și un cod 2FA nou; nu se emite automat o sesiune.

## Izolare și date

Funcția este activă numai pe originea configurată `https://sandbox.nitido.ro`, sau pe un localhost explicit în dezvoltare. Originea LIVE refuză pagina și rutele de recuperare. Nu se modifică valorile existente din Coolify, adresa administratorului, secretul MFA, conturile obișnuite de client/firmă sau funcțiile Marketing.

Schema este aditivă: `admin_password_credentials`, `admin_password_reset_tokens`, `admin_password_recovery_limits`. Parola recuperată este un override în SQLite, legat de configurația de infrastructură existentă. După resetare, parolele vechi din configurație nu sunt acceptate în paralel. O rotație de credențiale/MFA în infrastructură schimbă bindingul și are prioritate față de override. Conturile nominale păstrează rolul și verificările de activare/revizie.

Tokenurile se stochează numai ca hash. Devine utilizabil doar linkul acceptat de transportul email. Eșecul unei trimiteri ulterioare nu anulează un link deja acceptat. Cererile concurente nu permit unei trimiteri vechi, finalizate mai lent, să invalideze linkul mai nou. Tokenul se reverifică după calculul asincron bcrypt, în tranzacția finală. Rate limitingul pe cont este persistent și se aplică și când adresele IP declarate se schimbă.

Nu reveniți la o versiune veche care ignoră `admin_password_credentials` după resetări reale: ar readuce în vigoare parola veche din infrastructură. Păstrați cod compatibil cu override-urile sau efectuați o rotație autorizată în infrastructură. Backupurile bazei conțin hashurile și istoricul MFA; păstrarea lor rămâne privată.

## Verificare

Testele folosesc conturi și coduri sintetice, email simulat, SQLite izolat și verificarea browserului desktop/mobil. Acoperă linkuri expirate/refolosite, MFA greșit/repetat, conturi necunoscute/dezactivate, schimbări de configurație/rol, limite persistente, rollback la eșecul auditului, respingerea parolei vechi, autentificarea cu parola nouă și persistența după restart. Niciun test nu trimite emailuri reale și nu resetează parola administratorului real.

Publicarea se face exclusiv în sandbox, pornind de la versiunea Marketing `55c528597392d236505d43a9169a3ac060152b34`, după checkpoint SQLite. Verificările remote verifică pagina/butonul, sănătatea și refuzul cererilor invalide, fără a solicita un email real. Livrarea în inboxul beneficiarului nu este declarată testată. Un email real este solicitat numai când utilizatorul apasă butonul și introduce adresa contului în interfață.
