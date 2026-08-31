import { InformationPage } from "@/components/InformationPage";
export default function Page(){return <InformationPage eyebrow="PENTRU FIRME" title="Lucrări relevante, alocare clară și reputație construită în timp." intro="NITIDO.RO conectează firmele de curățenie cu lucrări din zonele declarate, prin reguli egale și confirmate de server." cta={{label:"Înregistrează-ți firma",href:"/signup?role=firma"}} sections={[
  {title:"De ce să intri în NITIDO.RO",paragraphs:["Primești acces la lucrări relevante pentru aria ta, fără licitație între firme. Alocarea urmează regula primei acceptări valide confirmate de server."]},
  {title:"Înregistrare și verificare",items:["Selectează cont Firmă.","Completează numele, emailul, telefonul și parola.","Introdu CUI-ul și zonele de acoperire.","NITIDO verifică formatul și încearcă validarea firmei active prin ANAF."]},
  {title:"Statusul verificării",paragraphs:["Firma este verificată numai când sursa ANAF confirmă o entitate activă. Dacă serviciul este indisponibil, profilul poate rămâne neverificat până la reverificarea administrativă autorizată."]},
  {title:"Zone și alerte",paragraphs:["Orașul principal și localitățile suplimentare stabilesc eligibilitatea geografică. Alertele pot veni prin platformă și SMS. Notificări push native nu sunt confirmate ca active în versiunea curentă."]},
  {title:"Înainte și după Accept",paragraphs:["Înainte vezi numai informațiile neconfidențiale necesare deciziei. După alocare, firma câștigătoare primește adresa exactă, fotografiile autorizate și detaliile de executare."]},
  {title:"Regula first valid Accept",paragraphs:["Interfața nu decide câștigătorul. Serverul verifică firma, zona, suspendarea, starea lucrării și plata; o singură acceptare atomică poate câștiga."]},
  {title:"Locație, status și istoric",paragraphs:["Adresa poate fi folosită după alocare într-o aplicație de hartă. Nu este confirmat un provider de hartă integrat în producție. Panoul arată lucrările alocate, statusurile și istoricul disponibil."]},
  {title:"Rating și responsabilitate",paragraphs:["Evaluările provin din lucrări reale. No-show-urile pot genera strike-uri, istoric și suspendare conform regulilor active."]},
  {title:"Câștiguri și plăți",paragraphs:["Datele lucrării pot arăta suma netă. Momentul exact al payout-ului nu este definit public în interfața actuală; AI-ul nu poate iniția sau confirma transferuri."]},
  {title:"Securitate și suport",items:["Accesul este separat pe roluri.","Adresa și fotografiile sunt protejate înainte de alocare.","Telefon: 0341.402.403","Email: contact@nitido.ro"]},
]}/>}
