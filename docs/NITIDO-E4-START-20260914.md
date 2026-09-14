# E4 — Business și Host, pornire după instalarea E3

E3 `3ef1fd7` a fost instalată cu healthcheck reușit la 20:10:01 UTC. Beneficiarul a autorizat începerea imediată a E4. Instrucțiunea de a nu repeta testele rămâne valabilă. Acest document nu declară întreaga E4 finalizată.

## Prima intervenție E4

Raportul de execuție este extins cu portofoliu Business sau întregul cont, locație, centru de cost, diferența măsurată între ora programată și sosirea confirmată, dosare totale/deschise și recepție. Interfața și CSV folosesc aceleași filtre. Totalul rămâne în RON; nici întârzierile, nici sesizările nu produc penalizări sau operațiuni financiare automate. Documentele rămân accesibile prin detaliul lucrării.

Lista firmelor pentru calendar include și firmele lucrărilor active/istorice. Lista mai strictă de firme eligibile ca preferință recurentă este separată; nu elimină opțiuni legitime din calendarul Business.

Sursa contabilizării lunare rămâne finalizarea în UTC, etichetată în UI/export. Datele proprietăților sunt cele curente; arhivarea nu șterge legătura din raport. Un snapshot contractual al centrului de cost necesită extindere separată înainte de facturare consolidată.

## Inventar și ordine de execuție

| Domeniu | Există în cod | Următoarea implementare |
|---|---|---|
| Portofolii | Proprietăți, centre de cost, bugete, import CSV cu previzualizare | Model organizațional explicit, politici pe organizație și domeniu distinct de contul personal |
| Roluri/aprobări | Invitații per locație, manager/viewer, solicitare, aprobare owner, blocarea bugetului | Praguri configurabile și separarea atribuțiilor de solicitare/aprobare/documente |
| Calendar | Zi/săptămână/lună, locație, firmă, status, serii E3 | Integrarea portofoliului organizației și filtre de interval în rapoarte |
| Raportare | Raport lunar și CSV, extinse în prima intervenție E4 | Snapshoturi istorice și raportarea documentelor/stărilor pe organizație |
| Host | Import manual ICS, UID+sursă+proprietate, reconcilierea evenimentelor prezente, semnalarea suprapunerilor, checklist și inventar | Interval checkout/checkin configurabil și propunere idempotentă a lucrării de turnover |
| Sincronizare Host | Ultimul import afișat, import manual, fără fetch extern | Conexiune iCal autorizată, programare și recuperare a sincronizării, tratarea anulărilor/actualizărilor lipsă din export |
| Activare | Paginile Business/Host existente | Oprire independentă a automatizării Host și activare pilot per organizație |

## Delimitări de produs

Facturarea consolidată, abonamentul software și integrarea PMS directă nu sunt activate prin raportul operațional. Nu există tarif comercial nou aprobat în această continuare. Pentru integrarea directă va fi folosit numai accesul autorizat oferit de furnizor; importul ICS nu este prezentat drept integrare bidirecțională.

E4 rămâne în execuție după această primă intervenție. Nu sunt atribuite rezultate noi de pilot, izolare sau sincronizare doar pentru că sursa compilează.

Compilarea primei intervenții E4 (`npm run build`, Next.js și TypeScript) s-a încheiat cu cod 0. Nu au fost executate teste.
