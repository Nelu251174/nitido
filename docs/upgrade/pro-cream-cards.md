# Cardurile Pro — crem conform capturilor

Captura cu marcaje C indică pagina publică /nitido-pro: comparația Fără/Cu NITIDO Pro și cardurile funcționale. Acestea folosesc pro-card, care avea background white în pro.css și nu era acoperit de tema conturilor din workspace-theme.css.

Fundalul pro-card este acum #F7F3EC, același crem ca bara publică aprobată. Se aplică tuturor cardurilor Pro, inclusiv pașilor, comparațiilor, publicurilor și întrebărilor frecvente. Suprafețele neutre pro-stat, pro-row, pro-empty și pro-sidebar folosesc aceeași culoare; câmpurile formularului folosesc #FBF7EF. Conturul public este bej #DDD4C5, iar textul secundar #52616A. Butoanele verzi cu contur auriu și panoul demonstrativ închis păstrează identitatea existentă.

Corecțiile conturilor și navigației cu derulare din PR68/72 sunt incluse prin istoricul ramurii. Pachetul include și verificarea eligibilității din PR73. Nu reprezintă închiderea A3 sau publicare LIVE.

Validare: am inspectat cele trei capturi și clasele exacte din pagina Pro. PostCSS parsează pro.css (93 reguli) și workspace-theme.css (43 reguli); git diff --check trece. Modificare exclusiv CSS/documentație, fără teste de business suplimentare. Aspectul efectiv în browserul sandbox rămâne de verificat după deploy; accesul browser fusese blocat anterior.
