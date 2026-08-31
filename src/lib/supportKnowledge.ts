export type SupportAudience = "all" | "client" | "firma";

export type SupportTopic = {
  id: string;
  title: string;
  aliases: string[];
  audience: SupportAudience;
  answer: string;
  canonicalFacts?: readonly string[];
  safeAnswerGuidance?: string;
  escalationCondition?: string;
};

const humanSupport = "Dacă vrei ajutor din partea echipei NITIDO, ne poți contacta la 0341.402.403 sau contact@nitido.ro.";
const authenticate = "Autentifică-te pentru a verifica informațiile specifice contului tău.";

export const SUPPORT_TOPICS: readonly SupportTopic[] = [
  {
    id: "post-job", title: "Cum postez o lucrare?", aliases: ["postez o lucrare", "public o lucrare", "comand curățenie"], audience: "client",
    answer: `Pentru a posta o lucrare pe NITIDO.RO, autentifică-te în contul de client și apasă Postează o lucrare.

Completează informațiile cerute despre serviciu: tipul spațiului sau al curățeniei, localitatea, adresa, suprafața, data și intervalul dorit și, dacă este necesar, fotografii sau observații pentru firmă.

Înainte de confirmare vei vedea informațiile relevante despre lucrare și prețul calculat conform regulilor platformei.

După ce publici lucrarea, NITIDO identifică firmele eligibile din zona respectivă și le trimite alerta de lucrare nouă. Adresa ta exactă nu trebuie expusă firmelor înainte ca lucrarea să fie alocată.

Prima firmă eligibilă care acceptă prin sistemul NITIDO poate primi lucrarea, după validările serverului și ale fluxului de plată aplicabil.

După confirmarea alocării vei vedea firma care a preluat lucrarea și vei putea urmări statusul din contul tău. NITIDO îți poate trimite și notificarea/SMS-ul de confirmare atunci când acest serviciu este activ.`
  },
  {
    id: "accept-job", title: "Cum acceptă o firmă o lucrare?", aliases: ["accept o lucrare", "firma acceptă", "preiau o lucrare"], audience: "firma",
    answer: `Firmele eligibile primesc alerte pentru lucrările disponibile în zonele lor de acoperire.

Firma deschide NITIDO, verifică informațiile disponibile înainte de alocare și apasă Accept dacă dorește lucrarea.

Acceptarea nu este decisă de telefon sau de interfață, ci de serverul NITIDO. Sistemul verifică autentificarea firmei, eligibilitatea, statusul lucrării și faptul că lucrarea nu a fost deja preluată.

Regula principală este primul Accept valid confirmat de server. Dacă mai multe firme încearcă simultan, o singură firmă poate câștiga lucrarea.

După alocarea confirmată, firma câștigătoare primește acces la informațiile necesare executării, inclusiv detaliile de locație permise după alocare.

Celelalte firme primesc informația că lucrarea nu mai este disponibilă.`
  },
  {
    id: "exact-address", title: "Când vede firma adresa exactă?", aliases: ["adresa exactă", "când vede adresa", "locația clientului", "de ce nu văd strada", "nu văd strada", "de ce nu văd adresa"], audience: "all",
    answer: `Adresa exactă a clientului este informație protejată.

Înainte de alocarea lucrării, firmele trebuie să vadă doar informațiile necesare pentru a decide dacă lucrarea este potrivită: zona/localitatea, tipul serviciului, suprafața, programarea și alte informații neconfidențiale relevante.

Adresa exactă este disponibilă numai firmei care a câștigat lucrarea după ce Accept-ul a fost confirmat de server și lucrarea a fost alocată corect.

O firmă care nu a câștigat lucrarea nu trebuie să poată obține adresa exactă prin interfață, API sau Asistentul AI.`
  },
  {
    id: "payment", title: "Cum funcționează plata?", aliases: ["cum plătesc", "plata", "card"], audience: "all",
    answer: `Plata este gestionată prin fluxul securizat al platformei NITIDO.

Atunci când o lucrare necesită autorizarea plății, serverul NITIDO inițiază operațiunea prin providerul de plată configurat. Interfața clientului sau a firmei nu poate declara singură că plata a fost autorizată.

În fluxul actual, plata poate fi autorizată înainte de executarea lucrării și capturată/finalizată conform stării reale a lucrării.

Dacă autorizarea necesară eșuează, lucrarea nu trebuie să rămână fals confirmată doar pentru că o firmă a apăsat Accept.

Datele complete ale cardului nu sunt gestionate de Asistentul AI, iar AI-ul nu poate modifica, captura, rambursa sau transfera bani.`
  },
  {
    id: "after-accept", title: "Ce se întâmplă după ce firma preia comanda?", aliases: ["după acceptare", "după ce preia", "firma a preluat"], audience: "all",
    answer: `După ce Accept-ul firmei este confirmat de server, lucrarea este alocată firmei câștigătoare.

Clientul vede firma care a preluat lucrarea și poate primi notificare sau SMS de confirmare.

Firma primește acces la detaliile necesare executării lucrării, inclusiv locația exactă atunci când regulile de confidențialitate permit acest lucru.

Lucrarea trece apoi prin stările operaționale ale platformei, de exemplu acceptată, sosită/începută și finalizată.

Clientul poate urmări statusul în cont, iar după finalizare poate continua fluxul de confirmare și evaluare.`
  },
  {
    id: "sms", title: "Ce SMS-uri trimite NITIDO?", aliases: ["sms-uri", "mesaje sms", "ce sms", "cum funcționează sms-ul", "cum funcționează sms"], audience: "all",
    answer: `NITIDO folosește SMS-uri tranzacționale pentru anumite evenimente importante atunci când serviciul SMS este activ.

La publicarea unei lucrări, firmele eligibile din zona respectivă pot primi un SMS de alertă cu informații generale despre lucrare. Din motive de confidențialitate, mesajul trimis înainte de alocare nu trebuie să conțină adresa exactă sau datele private ale clientului.

După ce o firmă câștigă lucrarea și serverul confirmă alocarea, clientul poate primi un SMS prin care este informat că lucrarea a fost preluată.

Când firma confirmă în mod autorizat sosirea la locație, clientul poate primi și o notificare de sosire.

SMS-ul este un canal de notificare. Starea oficială a lucrării rămâne cea din sistemul NITIDO.`
  },
  {
    id: "simultaneous-accept", title: "Ce se întâmplă dacă două firme apasă Accept?", aliases: ["două firme", "simultan accept", "cine câștigă", "două firme apasă accept simultan", "dacă două firme apasă accept"], audience: "all",
    answer: `Sistemul NITIDO este construit astfel încât o lucrare să nu poată fi atribuită simultan la două firme.

Serverul face acceptarea în mod atomic. Prima acceptare validă care schimbă lucrarea din disponibilă în acceptată câștigă.

Dacă o a doua firmă încearcă după ce prima acceptare a fost confirmată, serverul refuză operațiunea și informează firma că lucrarea a fost deja preluată.

Astfel, rezultatul nu depinde de viteza interfeței sau de ceea ce afișează temporar telefonul, ci de starea oficială confirmată de server.`
  },
  {
    id: "rating", title: "Cum funcționează ratingul?", aliases: ["rating", "evaluare", "stele"], audience: "all",
    answer: `După finalizarea unei lucrări, clientul poate evalua firma conform fluxului disponibil în NITIDO.

Ratingul ajută la construirea reputației firmei și oferă viitorilor clienți un indicator privind experiențele anterioare.

Evaluarea trebuie să fie asociată unei lucrări reale și unei relații reale client–firmă.

Asistentul AI poate explica ratingul și poate afișa informații permise din cont, dar nu poate crea, modifica sau șterge evaluări în numele utilizatorului.`
  },
  {
    id: "no-show", title: "Ce se întâmplă la no-show?", aliases: ["no-show", "nu se prezintă", "neprezentare"], audience: "all",
    answer: `Un no-show apare atunci când firma nu se prezintă la lucrarea acceptată în condițiile stabilite de platformă.

NITIDO poate înregistra incidentul și îl poate folosi în mecanismele de responsabilitate ale firmei, inclusiv strike-uri, istoric sau suspendare atunci când regulile sistemului o cer.

Impactul exact depinde de starea lucrării și de regulile active ale platformei.

Dacă ai o situație reală de no-show, folosește suportul asociat lucrării sau contactează echipa NITIDO la 0341.402.403.`
  },
  {
    id: "track-status", title: "Cum urmăresc statusul unei lucrări?", aliases: ["urmăresc statusul", "status lucrare", "unde este lucrarea"], audience: "all",
    answer: `Autentifică-te în contul NITIDO și deschide secțiunea Lucrările mele.

Acolo poți vedea lucrările tale și statusul fiecăreia, de exemplu în așteptare, acceptată, începută sau finalizată, în funcție de fluxul disponibil.

Pentru o lucrare activă poți vedea informațiile pe care contul tău este autorizat să le acceseze.

Dacă statusul afișat pare incorect sau nu se actualizează, folosește suportul asociat lucrării sau contactează NITIDO.`
  },
  {
    id: "contact-support", title: "Cum contactez suportul?", aliases: ["contact suport", "telefon nitido", "email nitido"], audience: "all",
    answer: `Poți folosi Asistentul AI NITIDO pentru întrebări generale despre platformă și pentru informații permise din propriul cont.

Pentru situații care necesită intervenție umană poți contacta NITIDO la:

Telefon: 0341.402.403
Email: contact@nitido.ro

Pentru o problemă legată de o lucrare existentă, este recomandat să folosești și zona de mesaje/suport asociată lucrării, astfel încât contextul să poată fi identificat corect.`
  },
  {
    id: "ai-capabilities", title: "Ce poate și ce nu poate face Asistentul AI?", aliases: ["ce poate ai", "asistentul ai", "poți accepta"], audience: "all",
    answer: `Asistentul AI NITIDO oferă informații și suport.

Poate explica modul în care funcționează platforma și, dacă ești autentificat, poate folosi doar informațiile din propriul cont pe care ai dreptul să le vezi.

Asistentul AI nu poate accepta sau atribui lucrări, modifica proprietarul unei lucrări, efectua plăți, rambursări sau payout-uri, verifica firme, modifica date administrative ori accesa datele private ale altor utilizatori.

Nu comunica Asistentului AI parole, coduri de autentificare sau date complete ale cardului.`
  },
  { id: "create-account", title: "Cum îmi creez cont?", aliases: ["creez cont", "cont nou", "înregistrare"], audience: "all", answer: `1. Deschide pagina Creează cont.
2. Alege rolul corect: Client sau Firmă de curățenie.
3. Completează numele, emailul, telefonul și o parolă de minimum 10 caractere, cu litere și cifre.
4. Dacă înregistrezi o firmă, completează și CUI-ul, orașul principal și, opțional, localitățile suplimentare acoperite.
5. Apasă Creează cont. Dacă datele sunt valide, vei fi autentificat și direcționat în panoul rolului ales.` },
  { id: "login", title: "Cum mă autentific?", aliases: ["mă autentific", "intru în cont", "login"], audience: "all", answer: `1. Deschide pagina Autentificare.
2. Selectează Client sau Firmă, conform tipului contului tău.
3. Introdu emailul și parola, apoi apasă Autentificare.

Dacă alegi alt rol decât cel asociat contului, NITIDO îți va indica tipul corect de cont.` },
  { id: "forgot-password", title: "Mi-am uitat parola", aliases: ["uitat parola", "resetare parolă", "recuperez parola"], audience: "all", answer: `NITIDO nu oferă în prezent un flux automat de resetare a parolei în interfața disponibilă. Nu crea un cont nou pentru a înlocui contul existent și nu transmite parola sau coduri de autentificare în conversație.

${humanSupport}` },
  { id: "edit-profile", title: "Cum îmi modific profilul?", aliases: ["modific profilul", "editez profil", "schimb numele"], audience: "all", answer: `În versiunea actuală nu există un flux complet de editare a profilului disponibil utilizatorului. Pentru corectarea datelor contului este necesară intervenția echipei NITIDO.

${authenticate}

${humanSupport}` },
  { id: "change-phone", title: "Cum îmi schimb numărul de telefon?", aliases: ["schimb telefonul", "număr de telefon nou", "modific telefon"], audience: "all", answer: `Numărul de telefon nu poate fi schimbat în prezent din profil. Deoarece este folosit pentru notificări tranzacționale, actualizarea trebuie verificată de echipa NITIDO.

${humanSupport}` },
  { id: "delete-account", title: "Cum îmi șterg contul?", aliases: ["șterg contul", "închid contul", "ștergere date", "cum îmi șterg contul"], audience: "all", answer: `Interfața actuală nu include o comandă de ștergere a contului. Trimite solicitarea de pe adresa asociată contului la contact@nitido.ro. Echipa va verifica identitatea și îți va comunica ce date pot fi șterse și ce date trebuie păstrate pentru obligații legale sau tranzacționale.

${humanSupport}` },
  { id: "register-firm", title: "Cum înregistrez o firmă?", aliases: ["înregistrez firmă", "cont firmă", "adaug firmă"], audience: "firma", answer: `1. Deschide Creează cont și selectează Firmă de curățenie.
2. Completează numele firmei, emailul, telefonul și parola.
3. Introdu CUI-ul unei firme reale și active.
4. Adaugă orașul principal și, opțional, localitățile suplimentare acoperite, separate prin virgulă.
5. Trimite formularul. NITIDO verifică CUI-ul prin serviciul ANAF disponibil la înregistrare.` },
  { id: "firm-verification", title: "Cum este verificată firma?", aliases: ["verificată firma", "verificare cui", "firmă verificată"], audience: "firma", answer: `La înregistrare, NITIDO validează formatul CUI-ului și încearcă verificarea firmei la ANAF. Firma este marcată verificată numai dacă ANAF confirmă că este reală și activă. Un CUI inexistent sau al unei firme radiate este refuzat. Asistentul AI nu poate schimba starea verificării.` },
  { id: "firm-unverified", title: "De ce firma apare neverificată?", aliases: ["apare neverificată", "neverificată", "nu sunt verificat"], audience: "firma", answer: `Firma poate apărea neverificată dacă serviciul ANAF a fost indisponibil la înregistrare sau dacă verificarea nu a putut confirma o firmă activă. O firmă neverificată nu este tratată ca eligibilă pentru alertele și acceptarea lucrărilor.

Starea poate fi reverificată numai prin fluxul administrativ autorizat. ${humanSupport}` },
  { id: "coverage", title: "Cum adaug orașe/zone de acoperire?", aliases: ["zone de acoperire", "adaug orașe", "localități acoperite"], audience: "firma", answer: `La crearea contului de firmă, completează orașul principal și localitățile suplimentare, separate prin virgulă. Potrivirea lucrărilor folosește aceste zone.

Interfața actuală nu oferă editarea ulterioară completă a zonelor. Pentru o firmă deja înregistrată, ${humanSupport.toLowerCase()}` },
  { id: "job-not-visible", title: "De ce nu văd o anumită lucrare?", aliases: ["nu văd lucrarea", "lucrare lipsește", "nu apare lucrarea"], audience: "firma", answer: `O firmă vede lucrările disponibile numai dacă este verificată, nesuspendată și acoperă localitatea lucrării. O lucrare poate lipsi și dacă a fost deja acceptată, anulată sau nu mai este disponibilă.

Pentru datele propriului cont, ${authenticate.toLowerCase()} Dacă problema persistă, contactează suportul cu identificatorul lucrării, dacă îl ai.` },
  { id: "cannot-accept", title: "De ce nu pot accepta o lucrare?", aliases: ["nu pot accepta", "accept refuzat", "eroare accept"], audience: "firma", answer: `Serverul refuză acceptarea dacă firma nu este autentificată, verificată și eligibilă pentru zonă, este suspendată, lucrarea nu mai este disponibilă sau o altă firmă a câștigat deja. Acceptarea poate eșua și dacă autorizarea de plată necesară nu reușește.

Reîncarcă statusul lucrării. Dacă rămâne disponibilă, încearcă din nou; dacă eroarea persistă, folosește suportul NITIDO.` },
  { id: "active-jobs", title: "Cum văd lucrările active?", aliases: ["lucrări active", "comenzi active"], audience: "all", answer: `Autentifică-te și deschide panoul rolului tău. Clientul vede propriile lucrări, iar firma vede lucrările care i-au fost alocate și lucrările disponibile pentru care este eligibilă. Selectează o lucrare pentru detaliile autorizate și statusul actual.` },
  { id: "history", title: "Cum văd istoricul?", aliases: ["văd istoricul", "istoric lucrări", "lucrări vechi"], audience: "all", answer: `Autentifică-te în panoul NITIDO și consultă lista lucrărilor proprii. Aceasta include stările curente și lucrările finalizate sau închise disponibile contului tău. Asistentul AI poate folosi numai istoricul limitat și autorizat furnizat de server, nu istoricul altui utilizator.` },
  { id: "firm-earnings", title: "Cum văd câștigurile firmei?", aliases: ["câștigurile firmei", "venituri", "suma netă"], audience: "firma", answer: `În panoul firmei poți vedea valorile asociate lucrărilor alocate, inclusiv suma netă disponibilă în datele lucrării/plății. Nu există în prezent un raport financiar complet separat documentat în interfață. Pentru reconciliere sau documente financiare, contactează echipa NITIDO.` },
  { id: "payout", title: "Când primesc banii?", aliases: ["primesc banii", "payout", "încasare firmă", "când ia firma banii", "când intră banii la firmă", "cont bancar firmă"], audience: "firma", answer: `După finalizarea validă și capturarea confirmată de procesator, NITIDO poate iniția transferul către contul Stripe eligibil al firmei. Confirmarea din platformă nu înseamnă că banii au ajuns instant în contul bancar: timpul efectiv depinde de Stripe și de circuitul bancar.

Transferurile reale sunt controlate de server și pot rămâne blocate dacă onboarding-ul Stripe nu este finalizat, capabilitatea de transfer nu este activă sau funcția nu a fost activată operațional de NITIDO.

Asistentul AI nu poate iniția sau confirma un payout. ${humanSupport}` },
  { id: "cancellation", title: "Cum funcționează anularea?", aliases: ["anulare", "anulez lucrarea", "comandă anulată"], audience: "all", answer: `Anularea este permisă numai prin fluxurile autorizate și depinde de starea lucrării. Dacă o rezervare de plată trebuie anulată, serverul actualizează plata conform rezultatului real; interfața sau AI-ul nu pot declara singure anularea.

Regulile și eventualele consecințe pentru fiecare moment al anulării nu sunt complet expuse în versiunea actuală. Pentru o lucrare reală, folosește suportul asociat lucrării.` },
  { id: "payment-failed", title: "Ce se întâmplă dacă plata eșuează?", aliases: ["plata eșuează", "card refuzat", "autorizare eșuată"], audience: "client", answer: `Dacă autorizarea necesară eșuează, serverul nu trebuie să lase lucrarea fals confirmată sau alocată. Verifică datele prin fluxul securizat al providerului de plată și încearcă din nou dacă aplicația permite. Nu trimite date complete de card Asistentului AI. Pentru o plată care rămâne blocată, contactează suportul cu identificatorul lucrării.` },
  { id: "send-photos", title: "Cum trimit poze?", aliases: ["trimit poze", "adaug fotografii", "încarc imagini"], audience: "client", answer: `În formularul de postare a lucrării poți încărca fotografii și le poți atașa înainte de publicare. Platforma acceptă cel mult 5 fotografii asociate unei lucrări. Folosește imagini relevante pentru evaluarea spațiului și evită documente, fețe sau alte date personale care nu sunt necesare.` },
  { id: "photo-visibility", title: "Cine poate vedea pozele?", aliases: ["vede pozele", "fotografii private", "acces imagini", "cine vede pozele"], audience: "all", answer: `Fotografiile unei lucrări sunt informații protejate. Clientul proprietar și firma căreia i-a fost alocată lucrarea le pot accesa prin verificările serverului. O firmă care doar vede o lucrare disponibilă nu trebuie să primească fotografiile private înainte de alocare, iar alți utilizatori nu au acces.` },
  { id: "messages", title: "Cum funcționează mesajele?", aliases: ["mesajele", "chat lucrare", "vorbesc cu firma"], audience: "all", answer: `Pentru o lucrare existentă, folosește zona de mesaje sau suport asociată lucrării, dacă este disponibilă în panoul tău. Mesajele trebuie folosite numai de participanții autorizați și păstrează contextul lucrării.

Funcțiile exacte de mesagerie nu sunt complet documentate în versiunea actuală; dacă zona nu apare, contactează suportul și menționează identificatorul lucrării.` },
  { id: "map", title: "Cum deschid locația în hartă?", aliases: ["deschid harta", "locația în hartă", "navigație"], audience: "firma", answer: `După alocare, firma câștigătoare poate folosi adresa exactă afișată în detaliile lucrării. Versiunea actuală nu documentează un buton garantat de deschidere directă într-o aplicație de hărți. Dacă nu există un astfel de buton, copiază adresa din lucrarea alocată într-o aplicație de navigație. Adresa nu este disponibilă firmelor înainte de alocare.` },
  { id: "push", title: "Cum funcționează notificările push?", aliases: ["notificări push", "push", "alertă aplicație"], audience: "all", answer: `Interfața actuală nu include o implementare verificată de notificări push pe dispozitiv. Evenimentele importante pot apărea în panoul NITIDO și, când serviciul este activ, prin SMS. Nu te baza pe o notificare push pentru starea oficială; verifică lucrarea în cont.` },
  { id: "sms-missing", title: "De ce nu am primit SMS?", aliases: ["nu am primit sms", "sms lipsă"], audience: "all", answer: `Un SMS poate lipsi dacă serviciul nu este activ/configurat, numărul din cont este invalid, firma nu era eligibilă pentru alertă sau providerul a refuzat ori nu a finalizat livrarea. Starea oficială rămâne cea din NITIDO.

Verifică lucrarea în cont și numărul asociat contului. Pentru investigarea livrării, contactează suportul.` },
  { id: "sms-delayed", title: "Ce fac dacă SMS-ul întârzie?", aliases: ["sms întârzie", "sms întârziat"], audience: "all", answer: `Nu aștepta SMS-ul pentru a confirma starea unei lucrări. Autentifică-te și verifică statusul direct în NITIDO, deoarece SMS-ul este doar un canal de notificare și poate fi livrat cu întârziere de operator/provider. Dacă întârzierea se repetă, contactează suportul.` },
  { id: "firm-late", title: "Ce fac dacă firma întârzie?", aliases: ["firma întârzie", "nu a ajuns firma"], audience: "client", answer: `Verifică statusul și mesajele lucrării în cont. Dacă există un canal asociat lucrării, folosește-l pentru context. Nu marca singur un no-show în afara fluxului platformei.

Dacă firma nu se prezintă în condițiile stabilite sau nu poți lua legătura cu ea, contactează imediat suportul NITIDO și menționează identificatorul lucrării.` },
  { id: "unsatisfactory", title: "Ce fac dacă serviciul nu este satisfăcător?", aliases: ["serviciu nesatisfăcător", "calitate slabă", "nemulțumit"], audience: "client", answer: `Documentează problema relevantă și păstrează comunicarea în contextul lucrării. După finalizare, folosește evaluarea disponibilă pentru a descrie sincer experiența. Pentru o contestație, daună sau situație care cere analiză, contactează suportul asociat lucrării. Asistentul AI nu poate modifica plata, acorda rambursări sau șterge evaluări.` },
  { id: "report-problem", title: "Cum raportez o problemă?", aliases: ["raportez problemă", "sesizare", "reclamație"], audience: "all", answer: `Pentru o problemă legată de o lucrare, folosește zona de suport asociată și include identificatorul lucrării, descrierea clară și numai dovezile relevante. Pentru probleme generale, contactează NITIDO la 0341.402.403 sau contact@nitido.ro. Nu trimite parole, coduri de autentificare sau date complete ale cardului.` },
  { id: "referral", title: "Cum funcționează programul de recomandare?", aliases: ["program recomandare", "cod recomandare", "referral"], audience: "all", answer: `Fiecare cont are un cod de recomandare. Un utilizator nou îl poate introduce opțional la înregistrare. Dacă acel cod există, utilizatorul nou și persoana care l-a recomandat primesc fiecare câte 20 lei credit în cont. Un cod invalid nu blochează înregistrarea, dar nu acordă bonusul. Creditul disponibil se aplică la prețul unei lucrări, până la valoarea acesteia.` },
  { id: "firm-personal-data", title: "Ce date personale vede firma?", aliases: ["date vede firma", "date personale firmă", "confidențialitate adresă"], audience: "client", answer: `Înainte de alocare, firmele văd numai date neconfidențiale necesare deciziei: localitatea/zona, tipul spațiului, suprafața, programarea și prețul relevant. După alocare, numai firma câștigătoare primește datele necesare executării, inclusiv adresa exactă. Fotografii și alte date private sunt protejate de verificările serverului.` },
  { id: "data-protection", title: "Cum îmi sunt protejate datele?", aliases: ["protejate datele", "securitatea datelor", "gdpr"], audience: "all", answer: `NITIDO limitează accesul la date în funcție de cont și rol. Parolele sunt stocate sub formă de hash, comunicarea de producție trebuie protejată prin HTTPS, iar datele complete ale cardului sunt procesate de providerul de plată și nu sunt stocate de NITIDO. Adresa și fotografiile unei lucrări sunt furnizate numai participanților autorizați. Pentru exercitarea drepturilor privind datele, scrie la contact@nitido.ro.` },
  { id: "admin-data", title: "Ce informații poate vedea Admin?", aliases: ["vede admin", "administrator date", "acces admin"], audience: "all", answer: `Personalul administrativ autorizat poate accesa informațiile necesare operării și suportului: lucrări, firme, stări de plată, incidente și notificări. Accesul administrativ este protejat și acțiunile sensibile sunt auditate; destinatarii SMS sunt mascați în prezentarea de administrare. Asistentul AI nu are drepturi de Admin și nu poate modifica date administrative.` },
  { id: "pricing", title: "Cum funcționează prețurile?", aliases: ["prețurile", "calcul preț", "cât costă"], audience: "all", answer: `Prețul unei lucrări este calculat automat din tipul spațiului și suprafață, conform regulilor active ale platformei, și este afișat înainte de publicare. Creditul de recomandare disponibil poate reduce suma plătită de client, fără a modifica baza integrală folosită pentru suma firmei. Pentru o ofertă exactă, completează formularul de postare.` },
  { id: "hidden-fees", title: "Există taxe ascunse?", aliases: ["taxe ascunse", "comision", "costuri suplimentare", "ce procent reține nitido", "procent oprește nitido", "18 82"], audience: "all", answer: `NITIDO afișează clientului prețul calculat înainte de publicarea lucrării. Pentru firmă, suma prezentată la acceptare este valoarea netă după comisionul platformei.

Configurația autoritară actuală folosește un comision nominal NITIDO de 18% și o sumă nominală pentru firmă de 82%, cu rotunjire la leu. Acest 18% este comision brut nominal, nu profit net: taxele Stripe, fiscalitatea și alte costuri nu sunt incluse într-un model de profit net. Creditele de recomandare pot reduce partea reținută de platformă fără să reducă suma calculată pentru firmă.` },
  { id: "available-cities", title: "Pentru ce orașe este disponibil NITIDO?", aliases: ["orașe disponibil", "localități nitido", "în ce oraș"], audience: "all", answer: `NITIDO potrivește lucrările cu orașul principal și localitățile suplimentare declarate de firme. Nu există în versiunea actuală o listă publică fixă și completă a tuturor orașelor active. Poți posta localitatea necesară, iar disponibilitatea efectivă depinde de existența firmelor verificate și eligibile în acea zonă.` },
  { id: "legal-entities", title: "Cum funcționează pentru persoane juridice?", aliases: ["persoane juridice", "client firmă", "factură"], audience: "client", answer: `Termenii NITIDO permit clienți persoane fizice sau juridice. Fluxul de bază pentru postare, alocare și plată este același. Interfața actuală nu oferă un profil complet separat de client juridic și nu documentează un flux automat complet de facturare. Pentru date fiscale sau documente necesare unei societăți, contactează echipa NITIDO înainte de comandă.` },
  { id: "without-mobile-app", title: "Pot folosi platforma fără aplicația mobilă?", aliases: ["fără aplicația mobilă", "din browser", "pe calculator"], audience: "all", answer: `Da. NITIDO este disponibil prin interfața web, pe care o poți deschide într-un browser pe telefon sau calculator. Nu este necesară o aplicație mobilă nativă pentru fluxurile web existente. Pentru alerte, verifică și panoul contului; disponibilitatea SMS-urilor depinde de configurarea serviciului.` },
  { id:"arrival-proof",title:"Este obligatorie fotografia la sosire?",aliases:["fotografie la sosire","poză la sosire","încep fără poză","dovadă sosire"],audience:"firma",answer:`Da. Firma alocată trebuie să încarce cel puțin o fotografie validă de tip Sosire înainte de a confirma sosirea sau începerea lucrării. Serverul verifică faptul că dovada aparține lucrării și firmei alocate; un simplu indicator trimis de interfață nu este suficient.

Dacă fotografia lipsește, tranziția către sosită/începută este refuzată. Dacă încărcarea eșuează, lucrarea nu își schimbă starea și firma poate încerca din nou.`},
  { id:"completion-proof",title:"Pot finaliza lucrarea fără fotografia finală?",aliases:["finaliza fără poza de final","termin fără poză","fotografia finală","poză de final","dovadă finalizare","plată blocată fără poză"],audience:"firma",answer:`Nu. Fotografia de finalizare este o condiție obligatorie verificată de server.

1. Firma alocată încarcă o fotografie validă de tip Finalizare.
2. Serverul verifică lucrarea, firma, tipul dovezii și starea acesteia.
3. Numai după existența dovezii, lucrarea poate trece în starea finalizată.
4. Fără stare finalizată nu se execută capturarea sau eliberarea plății și nu există eligibilitate pentru transfer.

O fotografie de la altă lucrare sau încărcată de alt utilizator nu poate satisface această cerință.`},
  { id:"stripe-connect",title:"Cum conectează firma contul Stripe?",aliases:["stripe connect","conectez stripe","onboarding stripe","cont stripe firmă","configurez încasările"],audience:"firma",answer:`În panoul firmei, folosește opțiunea Configurează încasările. NITIDO creează sau reutilizează server-side contul Stripe asociat firmei verificate și deschide onboarding-ul găzduit de Stripe.

Transferurile sunt permise numai când contul aparține firmei alocate, onboarding-ul este finalizat, capabilitatea Stripe Transfers este activă și funcția este activată operațional de NITIDO. NITIDO stochează identificatorul sigur al contului Stripe, nu datele bancare complete.`},
  { id:"refunds",title:"Cum funcționează rambursarea?",aliases:["refund","rambursare","banii înapoi","returnare plată","anulare după captură"],audience:"all",answer:`Rambursarea nu poate fi executată de Asistentul AI și nu este decisă de interfață. Pentru o plată capturată, fluxul autorizat poate efectua o rambursare integrală; dacă exista deja un transfer către firmă, acesta trebuie inversat înaintea rambursării plății platformei.

Rambursările parțiale nu sunt disponibile în fluxul actual. Pentru analizarea unei situații reale este necesară intervenția echipei NITIDO. ${humanSupport}`},
  { id:"verified-reviews",title:"Ce este o recenzie verificată?",aliases:["recenzie verificată","lucrare verificată","review verificat","recenzii reale"],audience:"all",answer:`O recenzie verificată este asociată unei lucrări NITIDO reale și eligibile: clientul este proprietarul lucrării, firma a fost alocată, lucrarea este finalizată, dovezile obligatorii există și plata este capturată. Serverul derivă firma și verificarea; utilizatorul nu poate seta singur insigna.

Este permisă o singură recenzie eligibilă pentru fiecare lucrare. Media firmei este calculată server-side numai din recenziile legitime și publicabile.`},
  { id:"report-review",title:"Cum raportez o recenzie?",aliases:["raportez o recenzie","raportez review","recenzie abuzivă","review fals","moderare recenzie"],audience:"all",answer:`Poți raporta o recenzie din fluxul disponibil folosind un motiv precum limbaj abuziv, date personale, spam, informații false sau alt motiv. Raportarea trimite recenzia spre analiză și nu o șterge automat.

Firma nu poate edita, șterge sau marca drept verificată recenzia clientului. Un administrator autorizat o poate publica, pune sub analiză sau ascunde, iar acțiunea este auditată.`},
  { id:"trust-center",title:"Ce este Centrul de Încredere?",aliases:["centrul de încredere","trust center","încredere și siguranță","siguranța nitido"],audience:"all",answer:`Pagina Încredere & Siguranță explică elementele verificabile ale marketplace-ului: verificarea firmelor, recenziile provenite din lucrări reale, dovezile foto, responsabilitatea la no-show, plata controlată de server și protejarea adresei exacte.

NITIDO afișează numai indicatori derivați din date reale. Nu folosește recenzii, ratinguri, numere sau certificări inventate.`},
  { id:"email-change",title:"Cum îmi schimb adresa de email?",aliases:["schimb emailul","modific email","adresă email nouă"],audience:"all",answer:`Interfața actuală nu oferă un flux complet pentru schimbarea adresei de email. Deoarece emailul identifică autentificarea și comunicarea contului, modificarea necesită verificarea identității de către echipa NITIDO.

${humanSupport}`},
  { id:"legal-pages",title:"Unde găsesc termenii și politica de confidențialitate?",aliases:["termeni și condiții","politica de confidențialitate","cookie-uri","cookies","date legale"],audience:"all",answer:`Documentele informative sunt disponibile pe site în paginile Termeni și condiții, Politica de confidențialitate și Politica de cookie-uri.

Cookie-urile strict necesare pot fi folosite pentru autentificare și funcționare. Aplicația nu trebuie să pretindă existența cookie-urilor de analytics sau marketing dacă acestea nu sunt active. Pentru o solicitare privind propriile date, scrie la contact@nitido.ro.`},
  { id:"native-apps",title:"Este NITIDO disponibil în App Store sau Google Play?",aliases:["app store","google play","aplicație ios","aplicație android","aplicație nativă"],audience:"all",answer:`Fluxurile NITIDO disponibile în prezent pot fi folosite în interfața web, din browser pe telefon sau calculator. Repository-ul actual nu confirmă publicarea unei aplicații native în App Store sau Google Play.

Nu instala aplicații care pretind că sunt NITIDO fără confirmarea canalelor oficiale.`},
  { id:"service-types",title:"Ce tipuri de spații sunt acceptate?",aliases:["tipuri servicii","tipuri de curățenie","apartament casă birou","ce pot posta"],audience:"client",answer:`Tipurile de spațiu acceptate în fluxul autoritar actual sunt apartament, casă, birou și alt tip de spațiu. Prețul este calculat pe server din tipul selectat și suprafață.

Etichete precum hotel, vilă, hală sau curățenie după constructor nu trebuie considerate categorii distincte dacă nu apar în formularul și configurația activă. Pentru o nevoie care nu se potrivește clar, alege numai opțiunea disponibilă relevantă sau contactează suportul înainte de postare.`},
] as const;

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("ro-RO").replace(/[^a-z0-9]+/g, " ").trim();
}

export function findSupportTopic(question: string): SupportTopic | undefined {
  const normalized = normalize(question);
  if (!normalized) return undefined;
  const exactTitle = SUPPORT_TOPICS.find((topic) => normalize(topic.title) === normalized);
  if (exactTitle) return exactTitle;
  const intentRules:readonly [RegExp,string][]=[
    [/\b(cand|cum).*(ia|intra|primesc|primeste).*(bani|plata).*(firma|firmei)|\bpayout\b/,"payout"],
    [/\b(finaliz|termin).*(fara).*(poza|fotograf)|\b(poza|fotografia).*(final|finalizare)\b/,"completion-proof"],
    [/\b(nu vad|ascunsa|protejata).*(strada|adresa|locatia)\b/,"exact-address"],
    [/\b(cum|unde).*(primesc|vad).*(firmele|firma).*(lucrar|comenz)|\blucrari.*disponibile\b/,"accept-job"],
    [/\b(procent|cat).*(retine|opreste|comision).*nitido|\b18\s*[/\-]?\s*82\b/,"hidden-fees"],
    [/\b(doua|2).*(firme).*(accept).*(simultan|odata)|\baccept.*simultan\b/,"simultaneous-accept"],
    [/\b(sms|mesaj text)\b/,"sms"],
    [/\b(urmaresc|tracking|status).*(firma|lucrare)|\bunde.*firma\b/,"track-status"],
    [/\b(raport|reclam).*(recenz|review)|\brecenzie.*(abuz|spam|fals)\b/,"report-review"],
    [/\b(fara|nu am).*(aplicatie)|\b(browser|calculator)\b/,"without-mobile-app"],
    [/\b(sterg|inchid).*(cont)\b/,"delete-account"],
    [/\b(cine|care).*(vede|acces).*(poze|fotograf)\b/,"photo-visibility"],
    [/\b(ce|cum).*(face|poate).*(ai|asistent)|\basistent.*(poate|face)\b/,"ai-capabilities"],
    [/\b(contact|vorbesc|ajutor).*(om|uman|suport|echipa)|\btelefon.*nitido\b/,"contact-support"],
  ];
  for(const [pattern,id] of intentRules){if(pattern.test(normalized))return SUPPORT_TOPICS.find(topic=>topic.id===id);}
  const matches = SUPPORT_TOPICS.flatMap((topic) => [topic.title, ...topic.aliases]
    .map((alias) => ({ topic, candidate: normalize(alias) })))
    .filter(({ candidate }) => normalized === candidate || normalized.includes(candidate))
    .sort((left, right) => right.candidate.length - left.candidate.length);
  if(matches[0])return matches[0].topic;
  const stop=new Set(["cum","cand","unde","care","este","sunt","pot","poate","daca","dupa","pentru","despre","nitido","unei","unui","firma","client","lucrare"]);
  const words=new Set(normalized.split(" ").filter(word=>word.length>2&&!stop.has(word)));
  if(!words.size)return undefined;
  const scored=SUPPORT_TOPICS.map(topic=>{
    const candidates=[topic.title,...topic.aliases].map(normalize);
    const candidateWords=new Set(candidates.flatMap(value=>value.split(" ")).filter(word=>word.length>2&&!stop.has(word)));
    let overlap=0;for(const word of words)if(candidateWords.has(word))overlap++;
    return {topic,score:overlap/Math.max(2,Math.min(words.size,candidateWords.size))};
  }).sort((a,b)=>b.score-a.score);
  return scored[0]?.score>=0.5?scored[0].topic:undefined;
}

export function buildKnowledgePrompt(): string {
  return SUPPORT_TOPICS.map((topic) => `[${topic.id}; audiență=${topic.audience}] ${topic.title}\n${topic.answer}${topic.canonicalFacts?.length?`\nFapte: ${topic.canonicalFacts.join("; ")}`:""}${topic.safeAnswerGuidance?`\nGhid sigur: ${topic.safeAnswerGuidance}`:""}${topic.escalationCondition?`\nEscaladare: ${topic.escalationCondition}`:""}`).join("\n\n---\n\n");
}
