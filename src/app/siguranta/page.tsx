import { InformationPage } from "@/components/InformationPage";
export default function Page(){return <InformationPage eyebrow="TRUST & SAFETY" title="Siguranță construită prin limite clare și autoritate pe server." intro="NITIDO.RO separă rolurile, minimizează datele expuse și păstrează operațiunile sensibile în fluxurile autorizate. Nu pretindem certificări de securitate care nu sunt documentate." sections={[
  {title:"Identitate și autentificare",paragraphs:["Conturile folosesc sesiuni protejate prin cookie httpOnly, iar parolele sunt stocate sub formă de hash. Utilizatorul este responsabil să nu divulge parola sau codurile de autentificare."]},
  {title:"Separarea rolurilor",paragraphs:["Client, Firmă și Admin au permisiuni distincte. Serverul verifică rolul și ownership-ul înainte de a returna date sau a executa o operațiune."]},
  {title:"Protecția adresei exacte",paragraphs:["Înainte de alocare, firmele văd numai informații neconfidențiale. Adresa exactă este disponibilă exclusiv firmei câștigătoare după Accept-ul confirmat de server."]},
  {title:"Alocare autoritară",paragraphs:["Prima acceptare validă schimbă atomic starea lucrării. Telefonul sau interfața nu pot atribui singure o lucrare și două firme nu o pot câștiga simultan."]},
  {title:"Autoritatea plății",paragraphs:["Serverul și providerul de plată controlează autorizarea și capturarea. Un eșec nu poate fi transformat de interfață într-o plată sau alocare reușită."]},
  {title:"Limitele Asistentului AI",paragraphs:["AI-ul oferă informații și context autorizat. Nu poate accepta ori atribui lucrări, modifica plăți, rambursări, payout-uri, conturi, verificări sau date administrative."]},
  {title:"Minimizarea datelor",paragraphs:["Contextul AI și răspunsurile API includ numai câmpurile necesare rolului. Datele private ale altor utilizatori nu sunt furnizate."]},
  {title:"Fotografii și datele lucrării",paragraphs:["Fotografiile sunt accesibile clientului proprietar și firmei alocate. Accesul direct este verificat pe server."]},
  {title:"Confidențialitatea SMS",paragraphs:["Alertele trimise înainte de alocare nu includ adresa exactă sau date private. SMS-ul informează; nu schimbă starea oficială."]},
  {title:"Incidente și no-show",paragraphs:["Problemele trebuie raportate în contextul lucrării. No-show-urile pot genera strike-uri și suspendare conform regulilor active."]},
  {title:"Contact de securitate",paragraphs:["Pentru probleme urgente sau suspiciuni de acces neautorizat: 0341.402.403 sau contact@nitido.ro. Nu include parole, coduri sau date complete de card."]},
]}/>}
