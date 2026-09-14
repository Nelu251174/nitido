# E2 — integritatea retrimiterii push

Bază: `fe3048e511b88795c71d4a2693241787489b9b34`. Cerințe: brief master §06, §16 și T12/T18. Beneficiarul a confirmat păstrarea verificării ANAF pentru toate firmele, inclusiv în sandbox; nu se introduce aprobare fictivă.

## Defecte reproduse și corectate

La dispatch, dispozitivul era citit o singură dată, fără reverificarea proprietarului, revocării sau dezactivării. Reîncercarea nu consulta preferințele actuale, verificarea/suspendarea/acoperirea firmei sau disponibilitatea lucrării. O listă explicită goală declanșa procesarea întregii cozi. Lipsa dispozitivului putea depăși limita de încercări, iar un alt worker aflat în trimitere putea declanșa prematur fallback SMS.

- Înaintea fiecărui apel către provider se recitesc destinatarul, preferința și dispozitivul activ asociat aceluiași cont.
- Alerta de oportunitate cere în continuare firmă verificată, nesuspendată, în zonă și lucrare în așteptare, nealocată. Verificarea ANAF nu este înlocuită și nu se schimbă datele firmei fictive.
- Evenimentele devenite neeligibile sunt păstrate ca `failed` cu motiv `SUPPRESSED_*`, fără retrimitere și fără fallback. Numărul de încercări nu este falsificat. Admin folosește același filtru de eligibilitate pentru retry.
- Toate ramurile folosesc claim condiționat; o listă goală nu trimite nimic, iar evenimentele trimise sau deja în procesare nu sunt revendicate din nou.
- Fallback-ul așteaptă încheierea trimiterilor în curs și epuizarea dispozitivelor retryabile; eligibilitatea este recitită înainte de a crea SMS-ul.
- Erorile arbitrare ale providerului nu sunt salvate în clar; se păstrează coduri controlate. Revocarea după token invalid este limitată la tokenul și proprietarul folosite pentru apel.

## Dovezi locale

Înainte de remediere, 13 din cele 14 scenarii inițiale noi eșuau. După remediere: 17 scenarii noi trecute; împreună cu suitele push, SMS și securityRoutes, **38 teste în 4 fișiere trecute**. ESLint pe fișierele TypeScript modificate: PASS. Providerii sunt simulați; nu s-au trimis SMS-uri sau push-uri reale prin aceste teste.

CI și deployment trebuie urmărite pe SHA-ul acestui commit; rezultatele unui candidat anterior nu se transferă automat. Nu există modificări de schemă sau migrări pentru această livrare.

## Limite deschise

- Nu este dovadă de livrare APNs/FCM/Twilio pe dispozitive fizice. Configurația furnizorilor și înregistrarea unui dispozitiv rămân necesare.
- După acceptarea unui mesaj de către provider, o revocare ulterioară nu poate retrage mesajul deja transmis.
- Recuperarea unui worker oprit cu un rând `sending`, rezultatul ambiguu după timeout și revalidarea SMS-urilor deja existente în coada separată rămân de tratat. Nu se declară livrare exact o dată către furnizori.
- Fluxul complet necesită o firmă reală eligibilă. Firma fictivă rămâne neverificată; nu există mod de test care ocolește ANAF.

## Acces ADMIN — actualizare operațională

Emailul, hashul parolei, cheia TOTP și hashurile de recuperare au fost configurate în sandbox. Deploymentul `90hqedlmg43ta6dehvmhqdls`, pe baza de mai sus, a fost verificat healthy; comparația configurației cu pachetul privat a trecut fără afișarea valorilor. Beneficiarul a confirmat în conversație că a intrat în ADMIN folosind autentificatorul. Aceasta este confirmarea beneficiarului pentru login, nu o probă automatizată pentru întregul dashboard. Recuperarea, expirarea/replay și restul matricei MFA pe staging rămân deschise. Nu se includ secrete în acest document.

E2 rămâne etapa activă. E3 începe după acceptarea nucleului; această corecție nu închide gate-urile Stripe, reconciliere, dispozitive sau restaurare.
