# E4 — Organizații și praguri de aprobare

## Livrare

Pagină `/client/organizatii`, accesibilă din meniul Business și Opțiuni profesionale. Organizații deținute de conturi client, cu denumire, locații Business proprii și politică versionată. Nicio locație existentă nu este mutată automat.

Roluri: titularul administrează politica, locațiile și membrii și finalizează rezervarea/plata; solicitantul creează cereri; aprobatorul decide; vizualizarea citește portofoliul și solicitările. Rolurile organizației înlocuiesc accesul acordat anterior pe locație atât timp cât locația este asociată. La eliminare se reaplică accesul anterior, explicit în confirmare.

Prag exprimat în RON, stocat ca bani întregi. Valoarea egală sau mai mare decât pragul cere aprobare manuală; sub prag, solicitarea este aprobată automat numai dacă bugetul permite. Pragul inițial 0 înseamnă aprobare manuală pentru orice valoare. Regula inițială de separare împiedică aprobarea manuală a propriei cereri; titularul o poate configura. Titularul fără alt aprobator poate invita un coleg sau modifica explicit politica.

## Aplicare pe server

- Solicitarea memorează organizația, revizia politicii, suma și tipul deciziei.
- Decizia și crearea cererii folosesc tranzacții IMMEDIATE. Aprobarea poate fi consumată de o singură rezervare cu locație, adresă, suprafață, tip, zi și preț identice.
- Pragul este reverificat în tranzacția rezervării și a generatorului recurent. O rezervare directă sub prag este permisă titularului; peste prag cere aprobare manuală consumată. Politica aplicată este memorată pe lucrare.
- Asocierea manuală a unei lucrări active nu evită pragul. Lucrările deja finalizate pot fi asociate pentru raportare, fără aprobare retroactivă. Mutarea unei lucrări asociate între portofolii organizaționale este blocată.
- Generarea recurentă peste prag este blocată cu motiv returnat de generator; nu creează automat aprobări sau plăți. Pentru aceste vizite se folosește rezervare aprobată individual. Automatizarea completă a aprobării unei serii nu este inclusă.
- Modificarea politicii retrage cererile/aprobările nefolosite. Revocarea unui membru retrage cererile sale și aprobările nefolosite date de el. Revizia politicii și rolul aprobatorului sunt reverificate la rezervare.
- Schimbarea politicii nu anulează lucrări deja rezervate. Bugetul lunar existent se aplică în continuare, inclusiv la reprogramare.
- Eliminarea unei locații din organizație este blocată cât timp există solicitări nefolosite, lucrări sau serii în curs. Istoricul se păstrează.
- Invitații de 7 zile, token stocat doar ca hash, acceptare numai de contul client corespunzător emailului. Linkurile se transmit manual de titular; nu se trimit emailuri automat.
- Rapoartele JSON/CSV ale titularului au filtrare suplimentară pe organizație; un identificator străin sau o locație din altă organizație este refuzat. Raportarea reflectă apartenența actuală a locațiilor; istoricul contractual consolidat rămâne separat.

## Verificare și limite

Revizuire de sursă, compilare Next.js/TypeScript încheiată cu cod 0 și ESLint fără erori pe modulul nou; fără teste funcționale, conform instrucțiunii beneficiarului. Nu se declară verificare manuală a rolurilor autentificate sau probă nouă de plată. Rezultatul instalării se înregistrează după compilarea pe server și healthcheck.

Acest modul nu finalizează întreaga etapă E4. Rămân Host/turnover, sincronizarea iCal autorizată, activarea independentă și raportarea istorică extinsă. Nu este activat un abonament software sau facturare consolidată. Comisionul platformei nu este expus firmelor.
