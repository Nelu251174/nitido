# Acces vizibil la evaluarea asistată

Continuă PR65. Fundalul crem a fost aprobat; utilizatorul a cerut să poată vedea noul flux, nu doar schimbarea culorii.

În pagina principală a contului Client apare un card pentru lucrări complexe, cu intrare directă în /client/evaluari. Meniul folosește eticheta Evaluări și oferte. Ghidul extensibil explică șase pași: cerere și fotografii, verificare NITIDO, ofertă acceptată, confirmarea echipei/programării, acceptarea firmei și execuție/plată. Adminul și firma primesc introduceri specifice rolului, fără expunerea marjei interne către client.

Pagina evaluării afișează un exemplu numai când serverul are NEXT_PUBLIC_SITE_URL=https://sandbox.nitido.ro. Utilizatorul apasă explicit pentru a completa formularul cu o renovare demonstrativă marcată DEMO SANDBOX. Butonul nu face cereri POST, nu creează date, nu încarcă fotografii și nu execută plăți. Trimiterea rămâne acțiunea explicită a utilizatorului. Oferta, capacitatea, verificarea foto și alocarea nu sunt simulate ca finalizate. Se elimină și ID-ul evaluari duplicat din secțiunea interioară Admin; ancora este păstrată în pagina părinte.

Validare: Next typegen, TypeScript, ESLint țintit, parsare PostCSS și git diff --check. Nu sunt adăugate teste care reproduc conținut static. Verificarea vizuală și fluxul real pe roluri în sandbox rămân restante din cauza restricției de acces documentate anterior. Nicio cerere demonstrativă nu a fost trimisă automat și nicio variabilă a serverului nu a fost schimbată.

Pentru review se instalează branchul feat/nitido-upgrade-assisted-journey exclusiv în nitido-v3-sandbox. Pagini: /client (cardul nou), /client/evaluari (ghid/exemplu), /admin#evaluari și /firma. Publicarea ofertelor și rezervarea asistată necesită flagurile din ghidul light-workspace.md. Noul ghid nu dovedește că aceste flaguri sunt active. Nu se declară închiderea integrală a A2, validarea Pro, LIVE sau distribuție mobilă.
