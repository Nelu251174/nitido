import { publicPageMetadata } from "@/lib/publicSeo";
import { InformationPage } from "@/components/InformationPage";
export const metadata = publicPageMetadata("/pentru-firme");
const content = {
  "eyebrow": "GHID NITIDO",
  "title": "Cum lucrează o firmă de curățenie prin NITIDO",
  "intro": "De la înscriere până la finalizarea unei lucrări, ai nevoie de un profil corect, acoperire realistă și confirmări făcute la timp. Ghidul explică selecția la Standard, preluarea Express, dovezile de execuție și diferența dintre finalizarea serviciului și încasarea banilor.",
  "sections": [
    {
      "title": "Profilul firmei și verificarea datelor",
      "paragraphs": [
        "Creează un cont de firmă cu datele reale ale reprezentantului, CUI-ul și localitățile pe care le poți acoperi. Verifică emailul și telefonul folosite pentru contact. Validarea disponibilă prin ANAF se referă la datele firmei; nu este o certificare a fiecărei echipe sau o garanție a calității viitoare.",
        "Dacă verificarea nu se încheie, citește mesajul din cont și cere suport pentru clarificare. Declară numai zone în care poți ajunge în condițiile programărilor acceptate. Un profil complet ajută clienții să înțeleagă serviciile și experiența ta."
      ]
    },
    {
      "title": "Disponibilitate și lucrări din aria acoperită",
      "paragraphs": [
        "Consultă lucrările disponibile în cont și verifică suprafața, serviciul, zona și programarea înainte să îți exprimi interesul. Ia în calcul echipa, deplasarea, echipamentele și timpul necesar. Primirea unei notificări nu rezervă automat lucrarea pentru firma ta.",
        "Alertele depind de canalele active și de configurarea dispozitivului. Verifică periodic platforma, chiar dacă folosești emailul sau SMS-ul. Înscrierea și declararea unei zone nu garantează un număr minim de lucrări sau un anumit venit."
      ]
    },
    {
      "title": "Candidatură Standard sau preluare Express",
      "paragraphs": [
        "La Standard, trimiți candidatura pentru lucrare, iar clientul alege dintre firmele interesate. Prezintă corect experiența și urmărește confirmarea din cont. Prețul rezervării este calculat de platformă; candidatura nu înseamnă că trebuie să licitezi un tarif mai mic.",
        "La Express, prima acceptare eligibilă confirmată poate aloca lucrarea direct. Acționează numai dacă ai disponibilitatea necesară. Dacă altă firmă a preluat deja lucrarea, nu porni către client pe baza unei alerte vechi; starea actuală a rezervării este cea relevantă."
      ]
    },
    {
      "title": "După alocare: adresă, acces și pregătire",
      "paragraphs": [
        "După confirmare primești detaliile autorizate necesare execuției. Citește observațiile clientului, verifică programarea și pregătește echipamentele potrivite. Datele adresei sunt oferite pentru realizarea serviciului și nu trebuie reutilizate pentru promovare sau distribuite persoanelor fără legătură cu lucrarea.",
        "Dacă identifici o cerință care depășește serviciul rezervat, cere clarificări înainte de executare. Nu promite intervenții pentru care nu ai resursele sau competențele necesare. Pentru impedimente de acces ori programare, documentează situația și contactează suportul."
      ]
    },
    {
      "title": "Sosire, dovezi și finalizarea intervenției",
      "paragraphs": [
        "Actualizează starea lucrării în momentul corespunzător și încarcă fotografiile cerute de flux. Dovezile trebuie să fie relevante pentru spațiu și serviciu, lizibile și asociate lucrării corecte. Evită fețele persoanelor, documentele și datele sensibile aflate în locuință.",
        "Finalizarea se confirmă numai după executare și după îndeplinirea cerințelor afișate. Nu încărca imagini de la alte lucrări și nu marca serviciul ca realizat pentru a grăbi plata. Dacă apare o eroare, păstrează contextul și cere ajutor înainte de repetarea unor operațiuni sensibile."
      ]
    },
    {
      "title": "Încasări, comision și reputație",
      "paragraphs": [
        "Verifică suma aferentă firmei în detaliile lucrării și starea contului de plăți conectat. Diferența dintre preț și comision nu reprezintă profit: firma își suportă propriile costuri și obligații fiscale. Finalizarea unei lucrări nu înseamnă că transferul bancar este deja vizibil în aceeași clipă.",
        "Recenziile clienților și incidentele contribuie la istoricul operațional. Respectă programările și comunică problemele înainte să se transforme în neprezentări. Pentru o diferență de plată, trimite suportului identificatorul lucrării și starea afișată, fără parole sau date bancare complete."
      ]
    }
  ],
  "cta": {
    "label": "Înregistrează firma",
    "href": "/signup?role=firma"
  }
};
export default function Page() { return <InformationPage {...content} />; }
