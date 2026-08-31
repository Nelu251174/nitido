import { InformationPage } from "@/components/InformationPage";
export default function Page(){return <InformationPage eyebrow="URMĂRIRE STATUS" title="Fiecare etapă confirmată rămâne vizibilă în cont." intro="Urmărirea în NITIDO.RO înseamnă stări operaționale ale lucrării, nu monitorizare GPS permanentă." sections={[
  {title:"Stările disponibile",items:["În așteptare","Acceptată","Sosită","Finalizată","Anulată","No-show"]},
  {title:"Când începe urmărirea",paragraphs:["Lucrarea apare în cont după publicare. După acceptarea validă, clientul vede firma alocată, iar firma vede detaliile necesare executării."]},
  {title:"Ce vede clientul",paragraphs:["Clientul vede numai propriile lucrări, statusul, programarea, plata permisă și ratingul asociat. Poate primi SMS la alocare și sosire când serviciul este activ."]},
  {title:"Ce vede firma",paragraphs:["Firma vede lucrările disponibile pentru care este eligibilă și detaliile lucrărilor care i-au fost alocate. Adresa exactă și fotografiile protejate sunt disponibile numai după alocare."]},
  {title:"Limite de confidențialitate",paragraphs:["O firmă nealocată nu poate accesa adresa exactă prin interfață, API sau AI. Utilizatorii nu pot consulta lucrările altor conturi."]},
  {title:"Hartă și localizare",paragraphs:["Firma poate folosi adresa alocată într-o aplicație de navigație. Proiectul nu confirmă un provider de hartă de producție și nu implementează urmărire GPS continuă."]},
  {title:"Status neactualizat",paragraphs:["Reîncarcă lucrarea în cont. Dacă starea rămâne incorectă, contactează 0341.402.403 sau contact@nitido.ro și include identificatorul lucrării."]},
]}/>}
