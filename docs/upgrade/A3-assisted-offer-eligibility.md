# A3 — Eligibilitate la candidatura Standard asistată

Crearea/reactivarea unei oferte Standard verifica deja firma, suspendarea, zona și capacitatea într-o tranzacție IMMEDIATE. Lipsea însă restricția către firma propusă și reverificarea echipei/serviciului din planul asistat.

Aceste verificări se execută acum în aceeași tranzacție, înainte de inserarea sau reactivarea ofertei. Refuzul păstrează oferta retrasă. Previzualizarea și acceptarea păstrează verificările lor independente; candidatura nu rezervă echipa și nu autorizează plata.

Ruta POST de ofertare aplică hasTrustedMutationOrigin, aceeași politică folosită de celelalte mutații protejate. Nu se modifică regulile comerciale, scorul, Stripe sau istoricul comenzilor.

Validare: 29 teste trecute în assistedAllocation și offers, inclusiv două scenarii noi pentru firma destinatară, serviciul dezactivat la reactivare și originea nepermisă; TypeScript fără erori. A3 rămâne deschis pentru auditul complet și verificarea pe roluri în sandbox. Nu este publicare LIVE sau build mobil. Tema crem din PR74 este inclusă.
