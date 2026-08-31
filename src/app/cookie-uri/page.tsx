import { InformationPage } from "@/components/InformationPage";
export default function Page(){return <InformationPage eyebrow="COOKIE-URI" title="Cookie-uri folosite de NITIDO.RO" intro="Auditul reflectă codul aplicației din această versiune. Orice instrument nou de analiză, marketing sau integrare terță trebuie adăugat aici și, când este necesar, în mecanismul de consimțământ." sections={[
  {title:"Strict necesare: nitido_session",paragraphs:["Cookie httpOnly folosit pentru autentificarea clientului sau firmei în browser. Are SameSite=Lax, Secure în producție, cale / și expirare la aproximativ 30 de zile. Este șters la logout."]},
  {title:"Strict necesare: nitido_admin_session",paragraphs:["Cookie httpOnly separat pentru sesiunea Admin. Are SameSite=Strict, Secure în producție, prioritate ridicată și expirare la aproximativ 8 ore. Nu oferă acces dacă autentificarea Admin nu este configurată."]},
  {title:"Preferințe",paragraphs:["Codul actual nu setează cookie-uri dedicate preferințelor. Dacă vor fi introduse, scopul și durata trebuie documentate înainte de activare."]},
  {title:"Analiză",paragraphs:["Nu am identificat instrumente sau cookie-uri de analytics active în codul actual. Nu afirmăm că măsurăm utilizatorii prin analytics în această versiune."]},
  {title:"Marketing",paragraphs:["Nu am identificat pixeli sau cookie-uri de marketing active. Activarea ulterioară necesită actualizarea politicii și, unde legea o cere, consimțământ prealabil."]},
  {title:"Terți și plăți",paragraphs:["Stripe sau alți furnizori pot seta propriile cookie-uri când utilizatorul interacționează cu o pagină sau componentă găzduită de aceștia. Codul actual nu încorporează un tracker terț general pe paginile informaționale."]},
  {title:"Controlul cookie-urilor",paragraphs:["Poți șterge sau bloca cookie-urile din browser. Blocarea cookie-urilor strict necesare împiedică autentificarea și menținerea sesiunii. Pentru întrebări: contact@nitido.ro sau 0341.402.403."]},
]}/>}
