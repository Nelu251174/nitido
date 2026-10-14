import {UiText,UiElement} from '@/components/UiText';
import Link from 'next/link';

const steps = [
 ['Descrii lucrarea', 'Alegi serviciul, localitatea și suprafața, explici ce trebuie făcut și adaugi fotografiile în cererea salvată. Trimiterea cererii nu rezervă o echipă și nu autorizează cardul.'],
 ['NITIDO verifică detaliile', 'Operatorul poate cere completări. Pentru renovări, fotografiile trebuie verificate înainte de ofertare. Disponibilitatea și costurile sunt analizate pentru lucrarea ta.'],
 ['Primești și accepți oferta', 'Vezi serviciile incluse, suma de plată și termenul ofertei. Citești condițiile și confirmi explicit oferta curentă; o ofertă expirată trebuie actualizată.'],
 ['Confirmi echipa și programarea', 'După propunerea operatorului, verifici firma, echipa, data, ora și durata. Completezi adresa și confirmi rezervarea. Lucrarea așteaptă acceptarea firmei.'],
 ['Firma acceptă lucrarea', 'Capacitatea este reverificată chiar la acceptare. Alocarea echipei se salvează în aceeași operațiune, pentru a preveni suprapunerile. Dacă echipa nu mai este disponibilă, acceptarea este refuzată.'],
 ['Urmărești execuția și plata', 'După alocare, urmărești lucrarea din Rezervări. Starea plății este separată de execuție; dacă banca solicită o confirmare, urmezi instrucțiunile afișate în cont.'],
];
export function AssistedJourney({role='client'}:{role?:'client'|'admin'|'firma'}) {
 const intro=role==='admin'
  ? 'Parcurge cererea, dovezile și calculul intern înainte de publicarea ofertei. După acceptarea clientului, propune planul și echipa. Clientul reconfirmă programarea, iar firma rezervă capacitatea prin acceptare.'
  :role==='firma'
  ? 'O lucrare asistată este pregătită de NITIDO și confirmată de client. Vezi propunerile adresate firmei tale, verifici echipa și intervalul, apoi accepți. Calendarul este reverificat la acceptare; o propunere nu ține loc de alocare.'
  : 'Pentru renovări, suprafețe mari sau cerințe speciale, începi cu o evaluare. Oferta și programarea se confirmă separat, astfel încât să știi ce servicii primești, cât plătești și ce echipă este propusă.';
 return <UiElement as="section" className="assisted-journey" aria-label="Ghidul evaluării asistate">
  <p className="v2-eyebrow"><UiText text={"Evaluare · Ofertă · Echipă · Execuție"}/></p>
  <h2>{role==='admin'?<UiText text={'De la cerere la echipa alocată'}/>:role==='firma'?<UiText text={'Cum preiei o lucrare asistată'}/>:<UiText text={'Cum ajungi de la evaluare la rezervare'}/>}</h2>
  <p>{<UiText text={intro}/>}</p>
  <details><summary><UiText text={"Vezi cei 6 pași și responsabilitatea fiecăruia"}/></summary><ol>{steps.map(([title,body])=><li key={title}><h3>{<UiText text={title}/>}</h3><p>{<UiText text={body}/>}</p></li>)}</ol></details>
  {role==='firma'&&<Link className="v2-btn v2-btn-secondary" href="/firma/calendar"><UiText text={"Verifică programul echipei"}/></Link>}
 </UiElement>;
}
export function AssistedEntry() {
 return <section className="assisted-journey assisted-entry">
  <div><p className="v2-eyebrow"><UiText text={"Pentru lucrări care necesită analiză"}/></p><h2><UiText text={"Ai o renovare, un spațiu mare sau cerințe speciale?"}/></h2><p><UiText text={"Descrie lucrarea și solicită o ofertă adaptată. În cont vei putea adăuga fotografii, răspunde la întrebări și verifica oferta, echipa și programarea înainte de rezervare."}/></p><p className="booking-muted"><UiText text={"Cererea de evaluare nu autorizează cardul și nu garantează disponibilitatea unei echipe."}/></p></div>
  <Link className="v2-btn v2-btn-primary" href="/client/evaluari"><UiText text={"Solicită evaluarea lucrării"}/></Link>
 </section>;
}
