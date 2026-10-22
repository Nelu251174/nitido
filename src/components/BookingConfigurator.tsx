'use client';
import {AUTHORIZATION_NOTICE} from '@/lib/authorizationPolicy';
import {useLocale} from 'next-intl';
import {UiText,UiElement,UiTemplate} from '@/components/UiText';
import {BookingLocation} from './BookingLocation';
import {BathroomExtra} from './BathroomExtra';
import {WindowsExtra} from './WindowsExtra';
import {useEffect,useMemo,useRef,useState,useTransition} from 'react';
import {ADS_CONSENT_EVENT} from '@/lib/googleAds';
import {trackBookingFunnel} from '@/lib/bookingFunnel';
import {useBookingDraft} from './useBookingDraft';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {DesignIcon} from './DesignIcon';
import {calcServicePrice,calcServiceDuration,validBathroomCount,calcBathroomPrice,calcWindowsPrice,validWindowsSqm,priceExplanation,SLOT_HOURS,type SpaceType} from '@/lib/pricing';
import {bookingDateKey,bucharestScheduledAt,hasSchedulingLeadTime} from '@/lib/scheduling';
import type {EstimatorOption} from '@/lib/estimatorConfig';

import {BOOKING_DURATION_NOTICE,BOOKING_TEAM_NOTICE} from '@/lib/bookingTerms';
import {CREDIT_POLICY_NOTICE} from '@/lib/referral';
import {CHECKLIST} from '@/lib/workspaceShared';

import {OwnedHomePicker} from "./OwnedHomePicker";

import {FlexibleChoice} from "./FlexibleChoice";
import {validateFlexibleWindows,readFlexibleDraft,type FlexibleWindow} from "@/lib/flexibleShared";

const STEPS=['Spațiu','Programare','Verificare'];
export function BookingConfigurator({initial,options,occasion}:{initial:Record<string,string>;options:EstimatorOption[];occasion?:'spring'}){
 const locale=useLocale();

 const router=useRouter(),heading=useRef<HTMLHeadingElement>(null);
 const [step,setStep]=useState(0),[error,setError]=useState('');
 const {draft,update,ready}=useBookingDraft(initial.date?{...initial,scheduled:'true'}:initial,{spaceType:options[0]?.key??'apartament',sqm:'80',city:'',bathroomCount:'1',windowsSqm:'0',scheduled:'false',date:'',hour:'',mode:'standard'});
 const flexibleWindows=useMemo(()=>readFlexibleDraft(draft.flexibleWindows),[draft.flexibleWindows]);
 const setFlexibleWindows=(windows:FlexibleWindow[]|null)=>update({flexibleWindows:windows?JSON.stringify(windows):''});
 const type=options.find(o=>o.key===draft.spaceType)?.key??options[0]?.key??'apartament',area=draft.sqm,city=draft.city;
 const bathroomCount=draft.bathroomCount===''?Number.NaN:Number(draft.bathroomCount),windowsSqm=Number(draft.windowsSqm);
 const scheduled=draft.scheduled==='true',date=bookingDateKey(draft.date)??draft.date,hour=draft.hour,mode=draft.mode==='express'?'express':'standard';
 const setType=(spaceType:SpaceType)=>update({spaceType}),setArea=(sqm:string)=>update({sqm}),setCity=(city:string)=>update({city});
 const setBathroomCount=(n:number)=>update({bathroomCount:Number.isNaN(n)?'':String(n)}),setWindowsSqm=(n:number)=>update({windowsSqm:String(n)});
 const setScheduled=(n:boolean)=>update({scheduled:String(n)}),setDate=(date:string)=>update({date}),setHour=(hour:string)=>update({hour}),setMode=(mode:string)=>update({mode});
 const [pending,startTransition]=useTransition();
 useEffect(()=>{const measure=()=>{if(ready){trackBookingFunnel('start');if(step===2)trackBookingFunnel('summary_view');}};measure();window.addEventListener(ADS_CONSENT_EVENT,measure);return ()=>window.removeEventListener(ADS_CONSENT_EVENT,measure);},[ready,step]);
 const [invalid,setInvalid]=useState('');
 function issue(field:string,message:string){setInvalid(field);return message;}
 function showIssue(message:string){trackBookingFunnel('field_error',invalidField.current);setError(message);requestAnimationFrame(()=>{const field=document.getElementById('booking-'+invalidField.current);field?.focus();field?.scrollIntoView({block:'center',behavior:'instant'});});}
 const invalidField=useRef('');
 function fail(field:string,message:string){invalidField.current=field;return issue(field,message);}
 function fieldError(field:string){return invalid===field&&error?<p className="booking-field-error" id={'error-'+field} role="alert"><UiText text={error}/></p>:null;}
 const valid=validBathroomCount(bathroomCount)&&validWindowsSqm(windowsSqm)&&Number.isInteger(Number(area))&&Number(area)>=10&&Number(area)<=1000;
 const price=valid?calcServicePrice(type,Number(area),windowsSqm,bathroomCount):null,duration=valid?calcServiceDuration(Number(area),windowsSqm):null;
 const label=options.find(o=>o.key===type)?.label??'Spațiu';
 const dateLabel=flexibleWindows?'Intervale flexibile · așteaptă propunerea firmei':bookingDateKey(date)?new Intl.DateTimeFormat(locale,{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Bucharest'}).format(new Date(date+'T12:00:00Z')):'Alege data';
 function validate(all=false){
  if(!options.some(o=>o.key===type))return fail('space','Nu există un tip de spațiu disponibil. Solicită o evaluare personalizată.');
  if(!city.trim())return fail('city','Completează localitatea în care dorești curățenia.');
  if(!validBathroomCount(bathroomCount))return fail('bathroomCount','Introdu numărul de băi, întreg între 0 și 20.');
  if(!validWindowsSqm(windowsSqm))return fail('windowsSqm','Introdu suprafața geamurilor între 0 și 200 m², fără zecimale.');
  if(!valid)return fail('area','Introdu o suprafață între 10 și 1.000 m², fără zecimale.');
  if(all&&flexibleWindows){try{validateFlexibleWindows(flexibleWindows);}catch(e){return fail("date",e instanceof Error?e.message:"Intervale invalide");}}
  if(all&&scheduled){
   if(!bookingDateKey(date))return fail('date','Alege o dată validă pentru curățenie.');
   if(!hour||!(SLOT_HOURS as readonly number[]).includes(Number(hour)))return fail('hour','Alege ora de începere.');
   if(!hasSchedulingLeadTime(bucharestScheduledAt(date,Number(hour))))return fail('date','Alege un interval cu cel puțin o oră înainte de începere, după ora României.');
  }
  return '';
 }
 function move(target:number){
  if(target>step){const issue=validate(target===2);if(issue){showIssue(issue);return;}}
  if(target>step){trackBookingFunnel(target===1?'space_valid':'schedule_valid');if(target===2)trackBookingFunnel('summary_view');}
  setError('');setStep(target);
  requestAnimationFrame(()=>{heading.current?.focus({preventScroll:true});heading.current?.scrollIntoView({block:'start',behavior:'instant'});});
 }
 function submit(){
  const issue=validate(step>0);if(issue){showIssue(issue);return;}
  if(step<2){move(step+1);return;}
  const params=new URLSearchParams({spaceType:type,sqm:area,city:city.trim(),mode,bathroomCount:String(bathroomCount),windowsSqm:String(windowsSqm)});
  if(flexibleWindows)params.set('flexibleWindows',JSON.stringify(flexibleWindows));
  if(draft.propertyId)params.set('propertyId',draft.propertyId);
  if(scheduled){params.set('date',date);params.set('hour',hour);}
  if(pending)return;
  trackBookingFunnel('account_requested');
  startTransition(()=>router.push(`/client?${params}#sec-form`));
 }
 return <div className="booking-wizard">
  <div className="booking-heading"><div><p className="booking-eyebrow"><UiText text={"REZERVAREA TA ÎNCEPE AICI"}/></p><h1><UiText text={occasion==='spring'?"Pregătește casa pentru primăvară":"Curățenia ta, în 3 pași."}/></h1><p><UiText text={"Configurezi acum. Verifici prețul înainte de publicare."}/></p></div><span className="booking-no-charge"><DesignIcon name="shield" size={18}/><UiText text={"Fără plată la acest pas"}/></span></div>
  {occasion==='spring'&&<section className="season-intro" aria-label="Despre curățenia de primăvară"><p><UiText text="Pornești de la curățenia generală a spațiului. Confirmă suprafața și băile; adaugă geamuri numai dacă le dorești. Vezi ce este inclus și fiecare supliment în rezumat."/></p><p><UiText text="Pentru lucrări după renovare, suprafețe speciale sau cerințe care depășesc serviciul general, solicită o evaluare înainte de rezervare."/> <Link href="/client/evaluari"><UiText text="Solicită evaluare"/></Link></p><p><UiText text="Nu se aplică o reducere sezonieră automată. Folosim tarifele curente, iar disponibilitatea firmei se confirmă prin fluxul rezervării."/></p></section>}
  <UiElement as="nav" aria-label="Pașii configurării"><ol className="booking-steps booking-wizard-steps">{STEPS.map((name,i)=><li key={name} className={step===i?'active':i<step?'complete':''}><button type="button" disabled={i>step} aria-current={i===step?'step':undefined} onClick={()=>move(i)}><span>{i<step?<DesignIcon name="check" size={18}/>:i+1}</span><b>{<UiText text={name}/>}</b><small>{<UiText text={['Tipul spațiului și suprafața','Data și alegerea firmei','Detaliile înainte de cont'][i]}/>}</small></button></li>)}</ol></UiElement>
  <form className="booking-grid" noValidate onSubmit={e=>{e.preventDefault();submit()}}>
   <div className="booking-main"><section className="design-panel booking-step-panel">
    <p className="booking-eyebrow"><UiText text={"PASUL "}/>{step+1}<UiText text={" DIN 3"}/></p><h2 ref={heading} tabIndex={-1}>{<UiText text={['Ce spațiu curățăm?','Când și cum rezervi?','Totul este pregătit pentru contul tău.'][step]}/>}</h2>
    {step===0&&<><OwnedHomePicker value={draft.propertyId??''} onSelect={p=>{if(p)update({propertyId:p.id,city:p.city,sqm:String(p.sqm),spaceType:p.space_type,bathroomCount:String(p.bathroom_count??1)});else update({propertyId:''});}}/><p className="booking-muted"><UiText text={"Alege spațiul și vezi estimarea actualizată în rezumat."}/></p><div className="booking-choice-grid">{options.map(o=><label className={`booking-choice ${type===o.key?'selected':''}`} key={o.key}><input type="radio" id={o===options[0]?"booking-space":undefined} name="space" value={o.key} checked={type===o.key} onChange={()=>setType(o.key)}/><DesignIcon name={o.key==='birou'?'building':'home'} size={28}/><b><UiText text={o.label}/></b><span>{o.key==='birou'?<UiText text={'Pentru un mediu de lucru îngrijit.'}/>:<UiText text={'Pentru un spațiu curat și primitor.'}/>}</span></label>)}</div><BookingLocation city={city} onDetected={setCity}/><div className="booking-fields"><label><UiText text={"Localitate"}/><input id="booking-city" aria-invalid={invalid==='city'&&!!error} aria-describedby={invalid==='city'?'error-city':undefined} placeholder="Introdu localitatea" required maxLength={100} autoComplete="address-level2" value={city} onChange={e=>setCity(e.target.value)}/>{fieldError('city')}</label><label><UiText text={"Suprafață, m²"}/><input id="booking-area" aria-invalid={invalid==='area'&&!!error} aria-describedby={invalid==='area'?'error-area':undefined} type="number" required min={10} max={1000} step={1} value={area} onChange={e=>setArea(e.target.value)}/>{fieldError('area')}</label></div><BathroomExtra id="booking-bathroomCount" value={bathroomCount} onChange={setBathroomCount}/><WindowsExtra id="booking-windowsSqm" value={windowsSqm} onChange={setWindowsSqm}/><div className="booking-assessment-note"><DesignIcon name="sparkles"/><div><b><UiText text={"Renovare sau cerințe speciale?"}/></b><p><UiText text={"Descrie lucrarea pentru o evaluare personalizată."}/></p><Link href={`/client/evaluari?${new URLSearchParams({city,sqm:area})}`}><UiText text={"Solicită evaluare "}/><DesignIcon name="arrow" size={16}/></Link></div></div></>}
    {step===1&&<><FlexibleChoice city={city} value={flexibleWindows} onChange={w=>{setFlexibleWindows(w);if(w){setMode('standard');setScheduled(true);setDate(w[0].date);setHour(String(w[0].from));}}}/><fieldset><legend><UiText text={"Momentul potrivit pentru tine"}/></legend><div className="booking-choice-grid"><label className={`booking-choice ${!scheduled?'selected':''}`}><input type="radio" name="when" checked={!scheduled} onChange={()=>{setFlexibleWindows(null);setScheduled(false);}}/><DesignIcon name="clock"/><b><UiText text={"Cât mai curând"}/></b><span><UiText text={"În funcție de disponibilitatea firmelor."}/></span></label><label className={`booking-choice ${scheduled?'selected':''}`}><input type="radio" name="when" checked={scheduled} onChange={()=>{setFlexibleWindows(null);setScheduled(true);}}/><DesignIcon name="calendar"/><b><UiText text={"Aleg data și ora"}/></b><span><UiText text={"Stabilești momentul preferat."}/></span></label></div></fieldset>{scheduled&&!flexibleWindows&&<div className="booking-fields"><label><UiText text={"Data preferată"}/><input id="booking-date" aria-invalid={invalid==='date'&&!!error} aria-describedby={invalid==='date'?'error-date':undefined} type="date" required value={date} onChange={e=>{setDate(e.target.value);setHour('');}}/>{fieldError('date')}</label><label><UiText text={"Ora de începere"}/><select id="booking-hour" aria-invalid={invalid==='hour'&&!!error} aria-describedby={invalid==='hour'?'error-hour':undefined} value={hour} required onChange={e=>setHour(e.target.value)}><option value=""><UiText text={"Selectează ora"}/></option>{SLOT_HOURS.map(h=><option key={h} value={h}>{String(h).padStart(2,'0')}:00</option>)}</select>{fieldError('hour')}</label></div>}<p className="booking-muted"><UiText text={"Orele sunt cele din România. Disponibilitatea se confirmă la alocare."}/></p><fieldset className="booking-mode-field"><legend><UiText text={"Cum alegi firma"}/></legend><div className="booking-choice-grid">{[['standard','Standard — Alegi firma','Vezi prețul și alegi dintre firmele interesate.'],['express','Express — Preluare în funcție de disponibilitate','O firmă eligibilă poate prelua cererea. Confirmarea apare în cont. Fără supliment pentru acest mod.']].map(([value,title,desc])=><label key={value} className={`booking-choice ${mode===value?'selected':''}`}><input type="radio" name="mode" value={value} checked={mode===value} onChange={()=>{setFlexibleWindows(null);setMode(value);}}/><DesignIcon name={value==='express'?'bolt':'calendar'} size={26}/><b>{<UiText text={title}/>}</b><span>{<UiText text={desc}/>}</span></label>)}</div></fieldset></>}
    {step===2&&<>{flexibleWindows&&<p className="booking-muted">Începere acceptată: {flexibleWindows.map(w=>`${w.date} între ${w.from}:00 și ${w.to}:00`).join(' / ')} · ora României. Vei confirma separat firma și ora exactă.</p>}<p className="booking-muted"><UiText text={"Verifică alegerile. Le poți modifica înainte de a continua."}/></p><div className="booking-review-row"><DesignIcon name="home"/><div><b><UiText text={label}/> · {area}<UiText text={" m²"}/></b><p>{city.trim()}</p></div><button type="button" onClick={()=>move(0)}><UiText text={"Modifică spațiul"}/></button></div><div className="booking-review-row"><DesignIcon name="calendar"/><div><b>{scheduled?dateLabel:<UiText text={'Cât mai curând'}/>}</b><p>{scheduled?<UiTemplate text={"{p0}:00 · ora României"} values={[hour.padStart(2,'0')]}/>:<UiText text={'În funcție de disponibilitate'}/>}</p></div><button type="button" onClick={()=>move(1)}><UiText text={"Modifică programarea"}/></button></div><div className="booking-review-row"><DesignIcon name={mode==='express'?'bolt':'check'}/><div><b>{mode==='express'?<UiText text={'Express'}/>:<UiText text={'Standard'}/>}</b><p>{mode==='express'?<UiText text={'O firmă eligibilă poate prelua cererea. Confirmarea apare în cont.'}/>:<UiText text={'Tu alegi firma dintre candidaturi.'}/>}</p></div><button type="button" onClick={()=>move(1)}><UiText text={"Modifică modul"}/></button></div><div className="booking-next-explainer"><b><UiText text={"Ce urmează în cont"}/></b><ol><li><UiText text={"Completezi adresa și instrucțiunile pentru echipă."}/></li><li><UiText text={"Verifici prețul final și eventualul credit eligibil."}/></li><li><UiText text={"Publici cererea când toate detaliile sunt corecte."}/></li></ol><p><UiText text={"Acest rezumat nu publică o lucrare și nu rezervă bani pe card."}/></p></div></>}
    <div className="booking-included"><b><UiText text="Inclus în curățenie"/></b><p><UiText text="Suprafețe, podele, o baie și o bucătărie. Băile suplimentare și spălarea geamurilor se adaugă separat."/></p><p><UiText text="Disponibilitatea se confirmă pentru cererea ta."/> <Link href={`/client/evaluari?${new URLSearchParams({city,sqm:area})}`}><UiText text="Solicită evaluare"/></Link> · <Link href="/contact"><UiText text="Verifică acoperirea"/></Link></p></div>
    {error&&<p className="booking-wizard-error" role="alert">{<UiText text={error}/>}</p>}
    <div className="booking-wizard-actions">{step>0&&<button type="button" className="booking-back" onClick={()=>move(step-1)}><UiText text={"Înapoi"}/></button>}<button type="submit" className="design-button" disabled={!options.length||!ready||pending} aria-busy={pending}>{<UiText text={pending?'Se deschide contul…':(step===1&&flexibleWindows?'Continuă cu aceste intervale':['Continuă la programare','Verifică rezervarea','Continuă în cont'][step])}/>}<DesignIcon name="arrow" size={20}/></button></div>
   </section></div>
   <aside className="booking-summary design-panel"><p className="booking-eyebrow"><UiText text={"ALEGERILE TALE"}/></p><h2><UiText text={"Rezumatul curățeniei"}/></h2><div className="booking-summary-line"><DesignIcon name="home"/><div><b><UiText text={label}/></b><p>{area||'—'}<UiText text={" m² · "}/>{city.trim()||<UiText text={'Alege localitatea'}/>}</p></div></div><div className="booking-summary-line"><DesignIcon name="calendar"/><div><b>{scheduled?dateLabel:<UiText text={'Cât mai curând'}/>}</b><p>{scheduled?(hour?<UiTemplate text={"{p0}:00 · ora României"} values={[hour.padStart(2,'0')]}/>:<UiText text={'Alege ora'}/>):<UiText text={'În funcție de disponibilitate'}/>}</p></div></div><div className="booking-summary-line"><DesignIcon name={mode==='express'?'bolt':'check'}/><div><b>{mode==='express'?<UiText text={'Express'}/>:<UiText text={'Standard'}/>}</b><p>{mode==='express'?<UiText text={'Preluare în funcție de disponibilitate'}/>:<UiText text={'Compari și alegi firma'}/>}</p></div></div><div className="booking-total"><div><b><UiText text={"Total estimat"}/></b><p><UiText text={"Curățenie + extraopțiuni selectate"}/></p></div><output aria-live="polite">{price??'—'}<UiText text={" lei"}/></output></div><dl className="booking-price-lines"><div><dt><UiText text="Curățenie"/></dt><dd>{valid?price!-calcBathroomPrice(bathroomCount)-calcWindowsPrice(windowsSqm):'—'} lei</dd></div>{bathroomCount>1&&validBathroomCount(bathroomCount)&&<div><dt>{bathroomCount-1} <UiText text={bathroomCount===2?'baie suplimentară':'băi suplimentare'}/></dt><dd>{calcBathroomPrice(bathroomCount)} lei</dd></div>}{windowsSqm>0&&validWindowsSqm(windowsSqm)&&<div><dt><UiText text="Geamuri"/> · {windowsSqm} m²</dt><dd>{calcWindowsPrice(windowsSqm)} lei</dd></div>}{mode==='express'&&<div><dt><UiText text="Supliment Express"/></dt><dd>0 lei</dd></div>}<div><dt><UiText text="Credit eligibil"/></dt><dd><UiText text="Se verifică în cont"/></dd></div></dl><p className="booking-muted"><UiText text="Disponibilitatea se confirmă pentru cererea ta. Creditul eligibil și prețul final se verifică înainte de publicare."/></p>{duration&&<p className="booking-duration"><DesignIcon name="clock" size={18}/><UiText text="Interval la locație: "/>{Math.floor(duration/60)} h {duration%60||''}{duration%60?' min':''}</p>}<details className="booking-muted"><summary><UiText text="Cum funcționează plata"/></summary><p><UiText text="Acum configurezi, fără plată. Banii sunt rezervați pe card la acceptarea validă a lucrării de către firmă și încasați la finalizarea validă. Transferul către firmă este o etapă separată."/></p><p><UiText text={AUTHORIZATION_NOTICE}/></p><p><UiText text={CREDIT_POLICY_NOTICE}/></p><Link href="/termeni"><UiText text="Anulări și incidente"/></Link></details><details className="booking-muted"><summary><UiText text="Condițiile rezervării"/></summary><p><UiText text="Selecțiile se recuperează după reîncărcare în aceeași filă, până la închiderea sesiunii browserului. Le poți modifica înainte de publicare."/></p><p>{priceExplanation(type,Number(area))}</p><p><UiText text={BOOKING_DURATION_NOTICE}/></p><p><UiText text={BOOKING_TEAM_NOTICE}/></p><ul>{CHECKLIST.map(item=><li key={item.key}><UiText text={item.label}/></li>)}</ul></details><div className="booking-summary-assurance"><DesignIcon name="shield"/><span><UiText text={"Nu se încasează bani în configurator."}/></span></div></aside>
  </form>
 </div>;
}
