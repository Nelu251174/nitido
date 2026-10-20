'use client';
import {AUTHORIZATION_NOTICE} from '@/lib/authorizationPolicy';
import {useLocale} from 'next-intl';
import {UiText,UiElement,UiTemplate} from '@/components/UiText';
import {BookingLocation} from './BookingLocation';
import {BathroomExtra} from './BathroomExtra';
import {WindowsExtra} from './WindowsExtra';
import {useRef,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {DesignIcon} from './DesignIcon';
import {calcServicePrice,calcServiceDuration,validBathroomCount,calcBathroomPrice,calcWindowsPrice,validWindowsSqm,priceExplanation,SLOT_HOURS,type SpaceType} from '@/lib/pricing';
import {bookingDateKey,bucharestScheduledAt,hasSchedulingLeadTime} from '@/lib/scheduling';
import type {EstimatorOption} from '@/lib/estimatorConfig';

import {BOOKING_DURATION_NOTICE,BOOKING_TEAM_NOTICE} from '@/lib/bookingTerms';
import {CREDIT_POLICY_NOTICE} from '@/lib/referral';
import {CHECKLIST} from '@/lib/workspaceShared';

const STEPS=['Spațiu','Programare','Verificare'];
export function BookingConfigurator({initial,options}:{initial:Record<string,string>;options:EstimatorOption[]}){
 const locale=useLocale();

 const router=useRouter(),heading=useRef<HTMLHeadingElement>(null);
 const [step,setStep]=useState(0),[error,setError]=useState('');
 const [type,setType]=useState<SpaceType>(options.find(o=>o.key===initial.spaceType)?.key??options[0]?.key??'apartament');
 const [area,setArea]=useState(initial.sqm&&Number(initial.sqm)>=10&&Number(initial.sqm)<=1000?initial.sqm:'80');
 const [city,setCity]=useState((initial.city??'').slice(0,100));
 const [bathroomCount,setBathroomCount]=useState(validBathroomCount(Number(initial.bathroomCount))?Number(initial.bathroomCount):1);
 const [windowsSqm,setWindowsSqm]=useState(validWindowsSqm(Number(initial.windowsSqm))?Number(initial.windowsSqm):0);
 const [scheduled,setScheduled]=useState(Boolean(initial.date));
 const [date,setDate]=useState(bookingDateKey(initial.date)??'');
 const [hour,setHour]=useState(initial.hour&&(SLOT_HOURS as readonly number[]).includes(Number(initial.hour))?String(Number(initial.hour)):'');
 const [mode,setMode]=useState(initial.mode==='express'?'express':'standard');
 const valid=validBathroomCount(bathroomCount)&&validWindowsSqm(windowsSqm)&&Number.isInteger(Number(area))&&Number(area)>=10&&Number(area)<=1000;
 const price=valid?calcServicePrice(type,Number(area),windowsSqm,bathroomCount):null,duration=valid?calcServiceDuration(Number(area),windowsSqm):null;
 const label=options.find(o=>o.key===type)?.label??'Spațiu';
 const dateLabel=date?new Intl.DateTimeFormat(locale,{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Bucharest'}).format(new Date(date+'T12:00:00Z')):'Alege data';
 function validate(all=false){
  if(!options.some(o=>o.key===type))return 'Nu există un tip de spațiu disponibil. Solicită o evaluare personalizată.';
  if(!city.trim())return 'Completează localitatea în care dorești curățenia.';
  if(!validBathroomCount(bathroomCount))return 'Introdu numărul de băi, întreg între 0 și 20.';
  if(!validWindowsSqm(windowsSqm))return 'Introdu suprafața geamurilor între 0 și 200 m², fără zecimale.';
  if(!valid)return 'Introdu o suprafață între 10 și 1.000 m², fără zecimale.';
  if(all&&scheduled){
   if(!bookingDateKey(date))return 'Alege o dată validă pentru curățenie.';
   if(!hour||!(SLOT_HOURS as readonly number[]).includes(Number(hour)))return 'Alege ora de începere.';
   if(!hasSchedulingLeadTime(bucharestScheduledAt(date,Number(hour))))return 'Alege un interval cu cel puțin o oră înainte de începere, după ora României.';
  }
  return '';
 }
 function move(target:number){
  if(target>step){const issue=validate(target===2);if(issue){setError(issue);return;}}
  setError('');setStep(target);
  requestAnimationFrame(()=>{heading.current?.focus({preventScroll:true});heading.current?.scrollIntoView({block:'start',behavior:'instant'});});
 }
 function submit(){
  const issue=validate(step>0);if(issue){setError(issue);return;}
  if(step<2){move(step+1);return;}
  const params=new URLSearchParams({spaceType:type,sqm:area,city:city.trim(),mode,bathroomCount:String(bathroomCount),windowsSqm:String(windowsSqm)});
  if(scheduled){params.set('date',date);params.set('hour',hour);}
  router.push(`/client?${params}#sec-form`);
 }
 return <div className="booking-wizard">
  <div className="booking-heading"><div><p className="booking-eyebrow"><UiText text={"REZERVAREA TA ÎNCEPE AICI"}/></p><h1><UiText text={"Curățenia ta, în 3 pași."}/></h1><p><UiText text={"Configurezi acum. Verifici prețul înainte de publicare."}/></p></div><span className="booking-no-charge"><DesignIcon name="shield" size={18}/><UiText text={"Fără plată la acest pas"}/></span></div>
  <UiElement as="nav" aria-label="Pașii configurării"><ol className="booking-steps booking-wizard-steps">{STEPS.map((name,i)=><li key={name} className={step===i?'active':i<step?'complete':''}><button type="button" disabled={i>step} aria-current={i===step?'step':undefined} onClick={()=>move(i)}><span>{i<step?<DesignIcon name="check" size={18}/>:i+1}</span><b>{<UiText text={name}/>}</b><small>{<UiText text={['Tipul spațiului și suprafața','Data și alegerea firmei','Detaliile înainte de cont'][i]}/>}</small></button></li>)}</ol></UiElement>
  <form className="booking-grid" noValidate onSubmit={e=>{e.preventDefault();submit()}}>
   <div className="booking-main"><section className="design-panel booking-step-panel">
    <p className="booking-eyebrow"><UiText text={"PASUL "}/>{step+1}<UiText text={" DIN 3"}/></p><h2 ref={heading} tabIndex={-1}>{<UiText text={['Ce spațiu curățăm?','Când și cum rezervi?','Totul este pregătit pentru contul tău.'][step]}/>}</h2>
    {step===0&&<><p className="booking-muted"><UiText text={"Alege spațiul și vezi estimarea actualizată în rezumat."}/></p><div className="booking-choice-grid">{options.map(o=><label className={`booking-choice ${type===o.key?'selected':''}`} key={o.key}><input type="radio" name="space" value={o.key} checked={type===o.key} onChange={()=>setType(o.key)}/><DesignIcon name={o.key==='birou'?'building':'home'} size={28}/><b><UiText text={o.label}/></b><span>{o.key==='birou'?<UiText text={'Pentru un mediu de lucru îngrijit.'}/>:<UiText text={'Pentru un spațiu curat și primitor.'}/>}</span></label>)}</div><BookingLocation city={city} onDetected={setCity}/><div className="booking-fields"><label><UiText text={"Localitate"}/><input required maxLength={100} autoComplete="address-level2" value={city} onChange={e=>setCity(e.target.value)}/></label><label><UiText text={"Suprafață, m²"}/><input type="number" required min={10} max={1000} step={1} value={area} onChange={e=>setArea(e.target.value)}/></label></div><BathroomExtra value={bathroomCount} onChange={setBathroomCount}/><WindowsExtra value={windowsSqm} onChange={setWindowsSqm}/><div className="booking-assessment-note"><DesignIcon name="sparkles"/><div><b><UiText text={"Renovare sau cerințe speciale?"}/></b><p><UiText text={"Descrie lucrarea pentru o evaluare personalizată."}/></p><Link href={`/client/evaluari?${new URLSearchParams({city,sqm:area})}`}><UiText text={"Solicită evaluare "}/><DesignIcon name="arrow" size={16}/></Link></div></div></>}
    {step===1&&<><fieldset><legend><UiText text={"Momentul potrivit pentru tine"}/></legend><div className="booking-choice-grid"><label className={`booking-choice ${!scheduled?'selected':''}`}><input type="radio" name="when" checked={!scheduled} onChange={()=>setScheduled(false)}/><DesignIcon name="clock"/><b><UiText text={"Cât mai curând"}/></b><span><UiText text={"În funcție de disponibilitatea firmelor."}/></span></label><label className={`booking-choice ${scheduled?'selected':''}`}><input type="radio" name="when" checked={scheduled} onChange={()=>setScheduled(true)}/><DesignIcon name="calendar"/><b><UiText text={"Aleg data și ora"}/></b><span><UiText text={"Stabilești momentul preferat."}/></span></label></div></fieldset>{scheduled&&<div className="booking-fields"><label><UiText text={"Data preferată"}/><input type="date" required value={date} onChange={e=>{setDate(e.target.value);setHour('');}}/></label><label><UiText text={"Ora de începere"}/><select value={hour} required onChange={e=>setHour(e.target.value)}><option value=""><UiText text={"Selectează ora"}/></option>{SLOT_HOURS.map(h=><option key={h} value={h}>{String(h).padStart(2,'0')}:00</option>)}</select></label></div>}<p className="booking-muted"><UiText text={"Orele sunt cele din România. Disponibilitatea se confirmă la alocare."}/></p><fieldset className="booking-mode-field"><legend><UiText text={"Cum alegi firma"}/></legend><div className="booking-choice-grid">{[['standard','Standard','Compari candidaturile și alegi firma.'],['express','Express','Prima firmă eligibilă care acceptă preia lucrarea.']].map(([value,title,desc])=><label key={value} className={`booking-choice ${mode===value?'selected':''}`}><input type="radio" name="mode" value={value} checked={mode===value} onChange={()=>setMode(value)}/><DesignIcon name={value==='express'?'bolt':'calendar'} size={26}/><b>{<UiText text={title}/>}</b><span>{<UiText text={desc}/>}</span></label>)}</div></fieldset></>}
    {step===2&&<><p className="booking-muted"><UiText text={"Verifică alegerile. Le poți modifica înainte de a continua."}/></p><div className="booking-review-row"><DesignIcon name="home"/><div><b><UiText text={label}/> · {area}<UiText text={" m²"}/></b><p>{city.trim()}</p></div><button type="button" onClick={()=>move(0)}><UiText text={"Modifică spațiul"}/></button></div><div className="booking-review-row"><DesignIcon name="calendar"/><div><b>{scheduled?dateLabel:<UiText text={'Cât mai curând'}/>}</b><p>{scheduled?<UiTemplate text={"{p0}:00 · ora României"} values={[hour.padStart(2,'0')]}/>:<UiText text={'În funcție de disponibilitate'}/>}</p></div><button type="button" onClick={()=>move(1)}><UiText text={"Modifică programarea"}/></button></div><div className="booking-review-row"><DesignIcon name={mode==='express'?'bolt':'check'}/><div><b>{mode==='express'?<UiText text={'Express'}/>:<UiText text={'Standard'}/>}</b><p>{mode==='express'?<UiText text={'Prima firmă eligibilă care acceptă.'}/>:<UiText text={'Tu alegi firma dintre candidaturi.'}/>}</p></div><button type="button" onClick={()=>move(1)}><UiText text={"Modifică modul"}/></button></div><div className="booking-next-explainer"><b><UiText text={"Ce urmează în cont"}/></b><ol><li><UiText text={"Completezi adresa și instrucțiunile pentru echipă."}/></li><li><UiText text={"Verifici prețul final și eventualul credit eligibil."}/></li><li><UiText text={"Publici cererea când toate detaliile sunt corecte."}/></li></ol><p><UiText text={"Acest rezumat nu publică o lucrare și nu rezervă bani pe card."}/></p></div></>}
    {error&&<p className="booking-wizard-error" role="alert">{<UiText text={error}/>}</p>}
    <div className="booking-wizard-actions">{step>0&&<button type="button" className="booking-back" onClick={()=>move(step-1)}><UiText text={"Înapoi"}/></button>}<button type="submit" className="design-button" disabled={!options.length}>{<UiText text={['Continuă la programare','Verifică rezervarea','Continuă în cont'][step]}/>}<DesignIcon name="arrow" size={20}/></button></div>
   </section></div>
   <aside className="booking-summary design-panel"><p className="booking-eyebrow"><UiText text={"ALEGERILE TALE"}/></p><h2><UiText text={"Rezumatul curățeniei"}/></h2><div className="booking-summary-line"><DesignIcon name="home"/><div><b><UiText text={label}/></b><p>{area||'—'}<UiText text={" m² · "}/>{city.trim()||<UiText text={'Alege localitatea'}/>}</p></div></div><div className="booking-summary-line"><DesignIcon name="calendar"/><div><b>{scheduled?dateLabel:<UiText text={'Cât mai curând'}/>}</b><p>{scheduled?(hour?<UiTemplate text={"{p0}:00 · ora României"} values={[hour.padStart(2,'0')]}/>:<UiText text={'Alege ora'}/>):<UiText text={'În funcție de disponibilitate'}/>}</p></div></div><div className="booking-summary-line"><DesignIcon name={mode==='express'?'bolt':'check'}/><div><b>{mode==='express'?<UiText text={'Express'}/>:<UiText text={'Standard'}/>}</b><p>{mode==='express'?<UiText text={'Prima firmă eligibilă care acceptă'}/>:<UiText text={'Compari și alegi firma'}/>}</p></div></div><div className="booking-total"><div><b><UiText text={"Total estimat"}/></b><p><UiText text={"Curățenie + extraopțiuni selectate"}/></p></div><output aria-live="polite">{price??'—'}<UiText text={" lei"}/></output></div><p className="booking-muted">{priceExplanation(type,Number(area))}<UiText text={". Numărul camerelor nu se taxează separat."}/></p>{validBathroomCount(bathroomCount)&&<p className="booking-muted">{bathroomCount}<UiText text=" băi · supliment: "/>{calcBathroomPrice(bathroomCount)}<UiText text=" lei"/></p>}{validWindowsSqm(windowsSqm)&&<p className="booking-muted"><UiText text={"Spălare geamuri: "}/>{windowsSqm}<UiText text={" m² · "}/>{calcWindowsPrice(windowsSqm)}<UiText text={" lei, separat de curățenie."}/></p>}{duration&&<p className="booking-duration"><DesignIcon name="clock" size={18}/><UiText text={"Intervenție programată la locație: "}/>{Math.floor(duration/60)}<UiText text={" h"}/>{duration%60?<UiTemplate text={" {p0} min"} values={[duration%60]}/>:''}</p>}<p className="booking-muted"><UiText text={BOOKING_DURATION_NOTICE}/></p><p className="booking-muted"><UiText text={BOOKING_TEAM_NOTICE}/></p><p className="booking-muted"><UiText text={AUTHORIZATION_NOTICE}/></p><p className="booking-muted"><UiText text={CREDIT_POLICY_NOTICE}/></p><details className="booking-muted"><summary><UiText text={"Operațiuni de bază; lista finală se confirmă pentru lucrare"}/></summary><ul>{CHECKLIST.map(item=><li key={item.key}><UiText text={item.label}/></li>)}</ul></details><p className="booking-muted"><UiText text={"Estimarea folosește tariful curent. Prețul final și creditul eligibil se verifică în cont înainte de publicare."}/></p><div className="booking-summary-assurance"><DesignIcon name="shield"/><span><UiText text={"Nu se încasează bani în configurator."}/></span></div></aside>
  </form>
 </div>;
}
