# LIVE — protecția autorizării, 20 octombrie 2026

Bază: 77396f8abf8f734b8b5e8172bd7a2f704cce17e0. Mandat: brief LIVE v2 și instrucțiunea proprietarului „EXECUTA”.

## Comportament

Cererile se pot programa din timp. Acceptarea finală pentru o lucrare încă în așteptare se deschide în ultimele 48 de ore, fereastră folosită deja la recurențe. Alocarea definitivă necesită autorizare manuală cu termenul real Stripe strict ulterior finalului intervenției și bufferului. Lipsa termenului nu este tratată drept șapte zile implicite. Nu se încasează la acceptare și nu se reautorizează automat.

Dacă o autorizare nouă nu acoperă intervenția, acceptarea revine în așteptare. Se poate anula numai HOLD-ul identificat prin metadate, sumă, monedă și cheia procesatorului, fără plată asociată. Un rezultat incert se păstrează durabil: lease, backoff, maximum opt încercări, maximum cinci elemente pe execuție. Operațiunile procesatorului din această mentenanță au timeout de patru secunde, fără retry SDK. O plată deja asociată cere verificare manuală; mentenanța nu o anulează. Nu există în acest worker capture, refund, transfer sau creare PaymentIntent.

API nou: POST /api/cron/authorization-coverage, exclusiv cu CRON_SECRET. Runner local: scripts/authorization-coverage-runner.mjs. Fără elemente scadente nu se instanțiază Stripe. Admin afișează incidentele și termenul efectiv. Nu sunt schimbate mecanismele de capturare, reprogramare sau transfer.

Snapshoturile noi au versiunea condițiilor v2 și identificatorul politicii de autorizare. Nicio rescriere a snapshoturilor, prețurilor, comisionului, duratei sau plăților comenzilor deja acceptate. Schema este aditivă.

## Validări

Build Next și TypeScript reușite. Suita extinsă: 1.866 teste trecute, șase eșuate în trei fișiere vechi; siteContent a fost separat după primul eșec. Cele șapte eșecuri din cele patru fișiere au fost reproduse și în versiunea anterioară, fără acest lot: BoardSidebar (trei aserțiuni structurale), quote (două durate), windowsPricing (o durată), siteContent (text cookie). Nu sunt declarate trecute și nu au fost mascate prin modificarea produsului.

Trec verificările noi pentru expirare lipsă/scurtă/egală, limita de 48 h, 3DS și refolosirea identității, lipsa capturării, rollback al alocării, proprietatea plății, schimbarea cheii, lease și limita încercărilor. Trec testele existente de izolare autentificată client, firmă, worker, organizație, Admin și Pro pe date sintetice locale.

Verificarea browserului: opt cazuri, 40/60/80/120 m², desktop 1366 și mobil 393, fără POST sau tranzacție. Simularea procesatorului nu este probă financiară reală; browserul mobil nu este dispozitiv nativ.

## Publicare și revenire

Înainte de publicare: backup SQLite online și copii uploaduri cu hashuri stabile, verificare integritate/FK și restaurare izolată; checkpoint /app/data/release-checkpoints/20261020-live-v2-before-coverage. Backupul se află pe volumul persistent existent, nu este copie off-host.

Publicare prin repository și Coolify, cu pin pe commitul verificat. După publicare: build efectiv, sănătate, browser read-only, protecții API, execuție manuală a mentenanței fără elemente și comparația câmpurilor comerciale ale comenzilor protejate. Runnerul se activează numai după această verificare.

Rollback cod: dezactivarea runnerului nou, revenire la pinul 77396f8 și redeploy. Nu ștergeți tabela de reconciliere și nu restaurați baza veche peste operațiuni legitime apărute ulterior. Incidentele păstrate trebuie reconciliate înainte de reluarea acceptărilor afectate.

## Limite care rămân

- Nu există dispozitiv fizic Android/iPhone, adb, emulator sau Xcode în mediul de execuție. Verificarea nativă login/cameră/deep link/revenire din plată rămâne BLOCATĂ. Shellul Capacitor din repository încarcă nitido.ro; asta nu dovedește versiunea binarului instalat pe telefon.
- Clarificare a proprietarului, ulterioară acestui lot: firma care acceptă lucrarea decide personalul și suportă propriile costuri. Aceste date nu sunt o condiție pentru prețul automat sau acceptarea lucrării. Lipsa lor nu mai reprezintă un blocaj al implementării. Comisionul de 18% rămâne distinct de profitul net.
- Prețurile existente se păstrează. Finalizarea validă nu este prelungită artificial și nu se facturează ore fictive. Nu se activează taxe noi, operațiuni suplimentare sau o nouă politică de taxare la finalizarea anticipată.
