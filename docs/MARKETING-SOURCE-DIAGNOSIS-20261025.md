# Marketing Constanța — diagnostic inițial, 25 octombrie 2026

Acest raport descrie blocajul anterior. Remedierea și inventarul real sunt documentate în [Marketing OSM Snapshot](MARKETING-OSM-SNAPSHOT-20261025.md).

Continuarea PR #150 privește exclusiv Marketing. `main` nu este baza publicată. Nu s-au modificat autentificarea, celelalte module, datele contactelor sau configurația de trimitere. Nu s-au trimis emailuri.

## Versiunile publicate

Confirmate prin API-ul Coolify și ultima publicare terminată:

| Mediu | Commit | Deployment | Stare |
| --- | --- | --- | --- |
| LIVE | `27a6993d93d70596c60ff695a69ed34708a0180b` | `symuafzgiowjpgewvbhy62dc` | finished, running:healthy |
| Sandbox | `7c79d011159535d8b4b341645b11f25c3aba32ee` | `i25qx762sh0diz0fhcnxaseq` | finished, running:healthy |

Ambele origini răspund `200` la `/api/health` și `401` la API-ul Marketing fără sesiune ADMIN. Modificările de diagnostic nu au fost publicate ca versiune nouă a aplicației.

## Rezultatul măsurat

`COOLIFY_LOGS_TOKEN` funcționează pentru citirea logurilor și a rezultatelor sarcinilor. `COOLIFY_TOKEN` a fost folosit, cu aprobarea explicită a proprietarului, pentru sarcina temporară dezactivată din sandbox. Scripturile au fost executate din commituri fixate; nu s-au modificat secretele.

Ultima verificare din container, 25 octombrie, 00:18:32 Europe/Bucharest (24 octombrie, 21:18:32 UTC):

| Destinație | DNS | TCP | TLS | Rezultat HTTP |
| --- | --- | --- | --- | --- |
| `https://nitido.ro/` | 1 ms | 5 ms | 21 ms | 200, complet în 62 ms |
| `https://overpass.private.coffee/api/status` | 1 ms | 15 ms | 27 ms | fără antete HTTP; ABORT_ERR după 12.004 ms |

Valorile TCP/TLS sunt timpi cumulați de la începutul cererii. Alte verificări cu aceeași identitate NITIDO au confirmat timeout și pe interpreter, inclusiv pentru o interogare minimă. Pagina principală Private.coffee a răspuns 200. O verificare cu clientul HTTP implicit a primit 429 de la `/api/status`; nu s-a folosit acel client pentru colectare. Testul unei alte instanțe OSM documentate (`maps.mail.ru`) a expirat tot după TLS, inclusiv pe interpreter; sursa colectorului nu a fost schimbată.

Aceste rezultate confirmă că timeouturile observate nu sunt la rezoluția DNS sau la stabilirea TCP/TLS. Nu stabilesc cauza internă a indisponibilității API-ului furnizorului. Nu justifică eliminarea TLS, a proxy-ului, a verificărilor de adrese publice, a cotelor ori schimbarea identității clientului pentru colectare.

Jobul Constanța din sandbox era `paused`, cu inventar 0 și contacte salvate 0. Nu există o verificare reușită de colectare reală >20 de firme sau de salvare a emailurilor. Datele sintetice din testele automate nu reprezintă rezultate reale.

## Livrabil și validare

- `scripts/marketing-network-diagnostic.cjs`: verificare manuală numai în sandbox, destinații fixe, timeout DNS/HTTPS, limită de răspuns, TLS și proxy păstrate; raportează doar timpi/coduri și numărul de octeți, fără corpuri HTTP, contacte sau credențiale. Nu rulează inventarul și nu importă transportul de email.
- `scripts/marketing-city-status.cjs`: SQLite deschis explicit read-only; raportează numai starea agregată Marketing, build ID și blocarea livrării. Nu importă inițializatorii aplicației și nu expune nume/emailuri.
- 86 teste Vitest Marketing trecute; verificarea Node a scriptului existent de pornire trecută; ESLint, verificările de sintaxă și `git diff --check` trecute pentru noile scripturi.
- Smoke-ul public din workspace a eșuat la DNS (`EAI_AGAIN`); verificările de rețea relevante au fost făcute în containerul sandbox.
- Buildul local a fost încercat și este blocat înaintea compilării aplicației de `ERR_SWC_NATIVE_CACHE`, privind proprietatea directoarelor cache din mediul managed. Nu este raportat drept build trecut; nu s-au schimbat dependențe sau configurația aplicației pentru a-l ocoli.

Publicarea Marketing pe LIVE rămâne aprobată, cu emailurile oprite, dar o remediere nouă nu este încă validată în sandbox. Colectarea rămâne în pauză. Următorul pas necesar este disponibilitatea unui endpoint de date care răspunde din sandbox, urmată de preluarea reală a inventarului și verificarea salvării contactelor. Nu se publică un schimb de sursă sau o pretinsă remediere fără aceste dovezi.

Referințe pentru sursa existentă și politica instanțelor: [Private.coffee](https://overpass.private.coffee/) și [lista oficială OSM](https://wiki.openstreetmap.org/wiki/Overpass_API#Public_Overpass_API_instances).
