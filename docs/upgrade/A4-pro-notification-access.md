# A4 — notificări și lista partenerului Pro

## Probleme verificate

Notificările salvate erau returnate după user_id fără reevaluarea accesului la resursă. Coada de email verifica numai existența unei apartenențe în organizație sau a oricărui partener activ; o firmă fără legătură cu lucrarea putea astfel păstra eligibilitatea pentru o alertă veche. Lista partenerului aplica limita de 500 lucrări înainte de filtrarea drepturilor, permițând lucrărilor altora să ascundă lucrările proprii.

## Implementare

- O verificare comună validează destinatarul, organizația și accesul actual la lucrare sau tichet. Notificările calendarului recurent verifică proprietatea regulii folosind identificatorul evenimentului existent.
- Lista notificărilor aplică drepturile înaintea limitei de 100 și expune aceleași câmpuri publice ca anterior. Marcarea drept citită verifică aceleași drepturi.
- Coada dezactivează notificările care nu mai sunt autorizate înainte de trimitere. Țintele necunoscute, externe sau din altă organizație sunt respinse. Erorile tehnice nu sunt mascate drept lipsă de drepturi.
- Lista partenerului filtrează în SQL apartenența activă, firma activă, alocarea și ofertele neexpirate înainte de limita de 500. Preview-ul nu dezvăluie adresa; o lucrare acceptată rămâne vizibilă după expirarea invitației, până la pierderea accesului operațional.

## Dovezi automate

Cinci teste de regresie au eșuat pe implementarea din PR #80 și trec după remediere:

1. Revocarea accesului chiar dacă utilizatorul aparține unei alte firme active.
2. Schimbarea scope-ului și recuperarea notificării permise după peste 100 notificări nepermise.
3. Coada trimite doar ținta autorizată; blochează scope străin, URL extern și organizație nepotrivită.
4. Revocarea notificărilor pentru tichete și calendar recurent.
5. Lucrarea partenerului rămâne vizibilă după peste 500 lucrări străine; expirarea ofertei și suspendarea firmei retrag accesul, iar acceptarea validează accesul la adresă.

56 teste Pro în două fișiere trecute în UTC și Europe/Bucharest. TypeScript noEmit și git diff --check trecute. Trimiterea emailurilor este simulată integral în teste; nu au fost trimise mesaje reale.

## Limite și livrare

Pachetul continuă PR #80. Tema crem este păstrată. Nu există migrare sau schimbare Stripe. Limitele existente de afișare rămân 100 notificări autorizate și 500 lucrări autorizate pentru partener; acest pachet nu implementează paginarea.

Codul și verificarea automată nu închid validarea în sandbox, pe dispozitive sau pilotul real A4. Nu s-a publicat în LIVE, TestFlight ori Google Play. A5 depinde în continuare de rezultatele pilotului și pragurile aprobate.
