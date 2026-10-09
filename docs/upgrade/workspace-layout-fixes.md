# Corecții navigație laterală și aliniere portofoliu

Corectează cele două situații semnalate în capturile utilizatorului: opțiuni profesionale afișate sub suprafața barei laterale și butonul Organizații și module ridicat față de selector.

Pe desktop, bara laterală are înălțime limitată de viewport, fallback 100vh și varianta 100dvh, cu safe-area. Lista de navigare poate ocupa spațiul rămas și se derulează intern, inclusiv după deschiderea Opțiuni profesionale. Elementele nu se comprimă și nu se împart în coloane la depășirea înălțimii; etichetele lungi se pot înfășura. Elementele de cont rămân în afara listei derulabile. Bara însăși poate derula când ecranul este prea scund pentru elementele fixe.

Toolbarul de portofoliu folosește alinierea la marginea de jos, selector cu etichetă separată și minimum 44px pentru ambele controale. Nota despre asocierea proprietăților ocupă un rând propriu. Pe mobil, selectorul și butonul se așază succesiv pe toată lățimea, fără a forța depășirea ecranului.

Tema crem deja aprobată este păstrată. Capturile primite arată bara verde; nu sunt dovada instalării celei mai recente versiuni. Corecția de layout nu depinde de înlocuirea textului alb cu altă culoare.

Validare: parsare PostCSS, Next typegen, TypeScript și diff check. Verificarea în browserul sandbox rămâne restantă din cauza restricției de acces documentate anterior. Nu se declară validare vizuală sau deploy. Pachetul include prin istoric etapa costurilor efective din PR67. Nicio regulă financiară sau de alocare nu se modifică.
