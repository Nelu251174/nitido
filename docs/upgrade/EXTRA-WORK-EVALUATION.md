# Suplimente — propunere și evaluare separată

## Lot publicabil

În instrucțiunile și remedierile unei lucrări, firma verificată alocată poate descrie un supliment, categoria, suprafața, camerele, băile, dificultatea și suma propusă în lei. Propunerea este valabilă 24h și poate fi retrasă; termenii nu se editează retroactiv.

Clientul proprietar poate refuza sau accepta **trimiterea la evaluare**, cu acord explicit că acest pas nu reprezintă plată, rezervare ori permisiune de începere. Acceptarea creează o singură cerere în modulul existent de evaluări, legată prin registrul de propuneri de lucrarea originală. Administrarea vede un semnal cu acțiunea următoare în Atenție azi. Clientul găsește cererea în Evaluările mele. Firma vede starea acceptării, nu conversația privată client–administrare.

Suma este o propunere a firmei, nu tarif publicat sau ofertă financiară finală. Nu s-au creat rezervări suplimentare, autorizări, capturi, transferuri sau rambursări automate. Lucrarea originală și plata ei rămân intacte. Nu se stabilește câți oameni trimite firma.

## Protecții

- Acces exclusiv proprietarului și firmei curente, autentificare, origine validată și rate limit.
- Propunerea este legată de firma și acceptarea curente, data, adresa, parametrii și prețul lucrării originale. Schimbarea acestora invalidează acordul încă nesalvat. Progresul firesc acceptat → sosit rămâne permis.
- Anulare, finalizare, firmă suspendată/nevalidată, termen expirat ori reprogramare în așteptare blochează acceptarea pentru evaluare.
- Cheie de idempotency, versiune și tranzacție imediată: repetarea propunerii sau a aprobării nu dublează evaluarea. Restricția clientului pentru evaluări anulează atomic întreaga aprobare.
- Istoricul și termenii au protecție la rescriere/ștergere; citirile nu schimbă statusuri. Identificatorul evaluării nu este expus firmei.
- Mesajele critice despre acord și lipsa plății sunt disponibile în cele nouă limbi existente. Restul textelor noi poate utiliza fallback român, fără a declara închisă traducerea integrală.

## Verificare

Suita completă: 2.181 teste / 212 fișiere, trecute. Testele dedicate verifică roluri, proprietari, origine, limite, erori, consimțământ, sume în bani întregi, datele măsurate, retragere/refuz, expirare, context schimbat, reacceptarea firmei, dublă apăsare, recuperare după rezultat necunoscut și păstrarea lucrării/plăților. TypeScript, ESLint și validatorul cataloagelor au trecut. Probele sunt sintetice; nu s-au declanșat mesaje sau operațiuni financiare de demonstrație.

Înainte de LIVE: snapshot nou, uploaduri verificate, restaurare izolată, aplicarea schemei numai pe copie și comparația datelor protejate. După build/publicare: sănătate, endpoint privat, fișiere livrate, limbile și bara fixă fără Noutăți. Browserul și telefonul fizic rămân NETESTATE în această sesiune.

## Etapa financiară rămasă

Ofertele personalizate existente sunt restricționate la sandbox prin manualOffersEnabled / managedBookingEnabled. Acest lot nu ocolește acele porți și nu publică un buton de plată nefuncțional. Următorul lot trebuie să implementeze separat oferta verificată, confirmarea comercială, rezervarea legată și propriul HOLD/captură, cu reconciliere și revenire, păstrând originalul. Aprobat pentru evaluare nu înseamnă aprobat pentru execuție.

## Revenire

Sursa anterioară: 90bb8ce4fcb13d9d0aa30ef0960284c705bf723c. Repinarea codului anterior păstrează registrul aditiv pentru audit; nu se restaurează automat baza peste activitate legitimă ulterioară și nu se repetă mesaje sau plăți.
