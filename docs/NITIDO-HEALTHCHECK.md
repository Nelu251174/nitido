# Verificarea disponibilității aplicației și SQLite

Imaginea Docker include `scripts/healthcheck.mjs`. Comanda de container pentru Coolify este `node /app/scripts/healthcheck.mjs`; nu necesită curl sau wget și nu conține credențiale.

Scriptul trimite GET la `http://127.0.0.1:PORT/api/stats/public`, cu timeout 3 secunde și redirecturi interzise. Endpointul execută citiri SQLite. Sunt necesare HTTP 200, JSON valid și contoare întregi nenegative pentru lucrări finalizate, firme verificate și recenzii. Orice eroare produce exit 1 și un mesaj generic; succesul produce exit 0.

Configurație țintă sandbox: interval 30 secunde, timeout exterior 5 secunde, 3 retry-uri, start period 20 secunde. Comanda trebuie activată numai împreună cu o imagine care include scriptul. Pentru rollback la o imagine mai veche, dezactivați verificarea sau folosiți o comandă inclusă în imaginea respectivă înainte de redeploy.

Testele folosesc un server HTTP local real: răspuns valid, HTTP 500, redirect care nu trebuie urmat, JSON invalid, schemă invalidă, conexiune refuzată și port invalid. CI execută proba automat.

Healthcheck-ul indică răspunsul aplicației și disponibilitatea citirilor folosite de endpoint. Nu validează Stripe, email, push, logarea, toate tabelele sau integritatea financiară. Nu constituie sistem extern de alerte și nu demonstrează restart automat la fiecare eroare.
