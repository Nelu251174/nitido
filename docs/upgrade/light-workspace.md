# Previzualizare — temă crem pentru workspace

Continuă PR64 la cererea utilizatorului de a vedea structura în sandbox și de a înlocui fundalurile închise cu alb cald/crem.

CSS-ul workspace-theme.css este încărcat după stilurile existente și se aplică doar interfețelor autentificate Client, Firmă, Admin, operațiuni și Pro. Fundal: #f7f3ec; navigație laterală: #f1ece3; bare superioare: #fffdf9; panourile rămân albe. Textul principal este #17212b, cel secundar #52616a. Se păstrează verdele acțiunilor, identitatea publică și conturul auriu al intrării Pro.

Nu se schimbă dimensiuni, poziționare, meniuri mobile, safe-area, reguli de rezervare, alocări sau plăți. Stilurile explicite pentru railul întunecat și railul verde anterior sunt suprascrise numai în scope-ul conturilor. Starea activă rămâne verde pal cu text verde închis; focusul tastaturii are contur verde închis.

Validare: parsare PostCSS, git diff --check și contrast calculat pentru text principal pe rail 13.85:1, text secundar 5.45:1, text verde pe selecție 4.91:1. Modificarea CSS reversibilă nu introduce teste care reproduc declarațiile. Verificarea vizuală desktop/mobil rămâne restantă; accesul automat la sandbox a fost blocat anterior. Nu este declarat deploy sau build mobil.

## Instalare pentru review

Exclusiv aplicația Coolify nitido-v3-sandbox, build Dockerfile. Se folosește branchul feat/nitido-upgrade-light-workspace și SHA-ul publicat în PR. Acesta include etapa de alocare atomică din PR64. Nu se folosește docker-compose.production.yml în sandbox: acel fișier fixează domeniul și volumele producției.

Pentru acțiunile ofertelor asistate sunt necesare variabilele runtime NITIDO_MANUAL_OFFERS_SANDBOX=true, NITIDO_MANUAL_OFFER_BOOKING_SANDBOX=true și NEXT_PUBLIC_SITE_URL=https://sandbox.nitido.ro, cu cheile Stripe de test existente. Nu se activează implicit NITIDO_MANAGED_PRICING_SANDBOX: acesta necesită în prealabil publicarea tarifului în registru. Nicio variabilă de server nu a fost modificată prin acest PR.

După deploy verificat: /admin#evaluari, /client/evaluari și /firma, cu rolul corespunzător. Reviewul vizual trebuie să includă sidebarul și meniul mobil, stările active/hover/focus, logo, text secundar, calendarul, formularul de ofertă și confirmarea planului. Datele reale și producția rămân în afara acestei previzualizări.

Revenirea exclusiv vizuală se face prin eliminarea importului workspace-theme.css, păstrând codul și tabelele alocării atomice din PR64.
