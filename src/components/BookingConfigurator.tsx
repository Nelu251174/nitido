'use client';
import {useRef,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {DesignIcon} from './DesignIcon';
import {calcGrossPrice,calcDurationMinutes,SLOT_HOURS,type SpaceType} from '@/lib/pricing';
import {bookingDateKey,bucharestScheduledAt,hasSchedulingLeadTime} from '@/lib/scheduling';
import type {EstimatorOption} from '@/lib/estimatorConfig';

const STEPS=['Spațiu','Programare','Verificare'];
export function BookingConfigurator({initial,options}:{initial:Record<string,string>;options:EstimatorOption[]}){
 const router=useRouter(),heading=useRef<HTMLHeadingElement>(null);
 const [step,setStep]=useState(0),[error,setError]=useState('');
 const [type,setType]=useState<SpaceType>(options.find(o=>o.key===initial.spaceType)?.key??options[0]?.key??'apartament');
 const [area,setArea]=useState(initial.sqm&&Number(initial.sqm)>=10&&Number(initial.sqm)<=1000?initial.sqm:'80');
 const [city,setCity]=useState((initial.city??'București').slice(0,100));
 const [scheduled,setScheduled]=useState(Boolean(initial.date));
 const [date,setDate]=useState(bookingDateKey(initial.date)??'');
 const [hour,setHour]=useState(initial.hour&&(SLOT_HOURS as readonly number[]).includes(Number(initial.hour))?String(Number(initial.hour)):'');
 const [mode,setMode]=useState(initial.mode==='express'?'express':'standard');
 const valid=Number.isInteger(Number(area))&&Number(area)>=10&&Number(area)<=1000;
 const price=valid?calcGrossPrice(type,Number(area)):null,duration=valid?calcDurationMinutes(Number(area)):null;
 const label=options.find(o=>o.key===type)?.label??'Spațiu';
 const dateLabel=date?new Intl.DateTimeFormat('ro-RO',{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Bucharest'}).format(new Date(date+'T12:00:00Z')):'Alege data';
 function validate(all=false){
  if(!options.some(o=>o.key===type))return 'Nu există un tip de spațiu disponibil. Solicită o evaluare personalizată.';
  if(!city.trim())return 'Completează localitatea în care dorești curățenia.';
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
  const params=new URLSearchParams({spaceType:type,sqm:area,city:city.trim(),mode});
  if(scheduled){params.set('date',date);params.set('hour',hour);}
  router.push(`/client?${params}#sec-form`);
 }
 return <div className="booking-wizard">
  <div className="booking-heading"><div><p className="booking-eyebrow">REZERVAREA TA ÎNCEPE AICI</p><h1>Curățenia ta, în 3 pași.</h1><p>Configurezi acum. Verifici prețul înainte de publicare.</p></div><span className="booking-no-charge"><DesignIcon name="shield" size={18}/>Fără plată la acest pas</span></div>
  <nav aria-label="Pașii configurării"><ol className="booking-steps booking-wizard-steps">{STEPS.map((name,i)=><li key={name} className={step===i?'active':i<step?'complete':''}><button type="button" disabled={i>step} aria-current={i===step?'step':undefined} onClick={()=>move(i)}><span>{i<step?<DesignIcon name="check" size={18}/>:i+1}</span><b>{name}</b><small>{['Tipul spațiului și suprafața','Data și alegerea firmei','Detaliile înainte de cont'][i]}</small></button></li>)}</ol></nav>
  <form className="booking-grid" noValidate onSubmit={e=>{e.preventDefault();submit()}}>
   <div className="booking-main"><section className="design-panel booking-step-panel">
    <p className="booking-eyebrow">PASUL {step+1} DIN 3</p><h2 ref={heading} tabIndex={-1}>{['Ce spațiu curățăm?','Când și cum rezervi?','Totul este pregătit pentru contul tău.'][step]}</h2>
    {step===0&&<><p className="booking-muted">Alege spațiul și vezi estimarea actualizată în rezumat.</p><div className="booking-choice-grid">{options.map(o=><label className={`booking-choice ${type===o.key?'selected':''}`} key={o.key}><input type="radio" name="space" value={o.key} checked={type===o.key} onChange={()=>setType(o.key)}/><DesignIcon name={o.key==='birou'?'building':'home'} size={28}/><b>{o.label}</b><span>{o.key==='birou'?'Pentru un mediu de lucru îngrijit.':'Pentru un spațiu curat și primitor.'}</span></label>)}</div><div className="booking-fields"><label>Localitate<input required maxLength={100} autoComplete="address-level2" value={city} onChange={e=>setCity(e.target.value)}/></label><label>Suprafață, m²<input type="number" required min={10} max={1000} step={1} value={area} onChange={e=>setArea(e.target.value)}/></label></div><div className="booking-assessment-note"><DesignIcon name="sparkles"/><div><b>Renovare sau cerințe speciale?</b><p>Descrie lucrarea pentru o evaluare personalizată.</p><Link href={`/client/evaluari?${new URLSearchParams({city,sqm:area})}`}>Solicită evaluare <DesignIcon name="arrow" size={16}/></Link></div></div></>}
    {step===1&&<><fieldset><legend>Momentul potrivit pentru tine</legend><div className="booking-choice-grid"><label className={`booking-choice ${!scheduled?'selected':''}`}><input type="radio" name="when" checked={!scheduled} onChange={()=>setScheduled(false)}/><DesignIcon name="clock"/><b>Cât mai curând</b><span>În funcție de disponibilitatea firmelor.</span></label><label className={`booking-choice ${scheduled?'selected':''}`}><input type="radio" name="when" checked={scheduled} onChange={()=>setScheduled(true)}/><DesignIcon name="calendar"/><b>Aleg data și ora</b><span>Stabilești momentul preferat.</span></label></div></fieldset>{scheduled&&<div className="booking-fields"><label>Data preferată<input type="date" required value={date} onChange={e=>{setDate(e.target.value);setHour('');}}/></label><label>Ora de începere<select value={hour} required onChange={e=>setHour(e.target.value)}><option value="">Selectează ora</option>{SLOT_HOURS.map(h=><option key={h} value={h}>{String(h).padStart(2,'0')}:00</option>)}</select></label></div>}<p className="booking-muted">Orele sunt cele din România. Disponibilitatea se confirmă la alocare.</p><fieldset className="booking-mode-field"><legend>Cum alegi firma</legend><div className="booking-choice-grid">{[['standard','Standard','Compari candidaturile și alegi firma.'],['express','Express','Prima firmă eligibilă care acceptă preia lucrarea.']].map(([value,title,desc])=><label key={value} className={`booking-choice ${mode===value?'selected':''}`}><input type="radio" name="mode" value={value} checked={mode===value} onChange={()=>setMode(value)}/><DesignIcon name={value==='express'?'bolt':'calendar'} size={26}/><b>{title}</b><span>{desc}</span></label>)}</div></fieldset></>}
    {step===2&&<><p className="booking-muted">Verifică alegerile. Le poți modifica înainte de a continua.</p><div className="booking-review-row"><DesignIcon name="home"/><div><b>{label} · {area} m²</b><p>{city.trim()}</p></div><button type="button" onClick={()=>move(0)}>Modifică spațiul</button></div><div className="booking-review-row"><DesignIcon name="calendar"/><div><b>{scheduled?dateLabel:'Cât mai curând'}</b><p>{scheduled?`${hour.padStart(2,'0')}:00 · ora României`:'În funcție de disponibilitate'}</p></div><button type="button" onClick={()=>move(1)}>Modifică programarea</button></div><div className="booking-review-row"><DesignIcon name={mode==='express'?'bolt':'check'}/><div><b>{mode==='express'?'Express':'Standard'}</b><p>{mode==='express'?'Prima firmă eligibilă care acceptă.':'Tu alegi firma dintre candidaturi.'}</p></div><button type="button" onClick={()=>move(1)}>Modifică modul</button></div><div className="booking-next-explainer"><b>Ce urmează în cont</b><ol><li>Completezi adresa și instrucțiunile pentru echipă.</li><li>Verifici prețul final și eventualul credit eligibil.</li><li>Publici cererea când toate detaliile sunt corecte.</li></ol><p>Acest rezumat nu publică o lucrare și nu rezervă bani pe card.</p></div></>}
    {error&&<p className="booking-wizard-error" role="alert">{error}</p>}
    <div className="booking-wizard-actions">{step>0&&<button type="button" className="booking-back" onClick={()=>move(step-1)}>Înapoi</button>}<button type="submit" className="design-button" disabled={!options.length}>{['Continuă la programare','Verifică rezervarea','Continuă în cont'][step]}<DesignIcon name="arrow" size={20}/></button></div>
   </section></div>
   <aside className="booking-summary design-panel"><p className="booking-eyebrow">ALEGERILE TALE</p><h2>Rezumatul curățeniei</h2><div className="booking-summary-line"><DesignIcon name="home"/><div><b>{label}</b><p>{area||'—'} m² · {city.trim()||'Alege localitatea'}</p></div></div><div className="booking-summary-line"><DesignIcon name="calendar"/><div><b>{scheduled?dateLabel:'Cât mai curând'}</b><p>{scheduled?(hour?`${hour.padStart(2,'0')}:00 · ora României`:'Alege ora'):'În funcție de disponibilitate'}</p></div></div><div className="booking-summary-line"><DesignIcon name={mode==='express'?'bolt':'check'}/><div><b>{mode==='express'?'Express':'Standard'}</b><p>{mode==='express'?'Prima firmă eligibilă care acceptă':'Compari și alegi firma'}</p></div></div><div className="booking-total"><div><b>Total estimat</b><p>Serviciu de curățenie</p></div><output aria-live="polite">{price??'—'} lei</output></div>{duration&&<p className="booking-duration"><DesignIcon name="clock" size={18}/>Durată estimată: {Math.floor(duration/60)} h{duration%60?` ${duration%60} min`:''}</p>}<p className="booking-muted">Estimarea folosește tariful curent. Prețul final și creditul eligibil se verifică în cont înainte de publicare.</p><div className="booking-summary-assurance"><DesignIcon name="shield"/><span>Nu se încasează bani în configurator.</span></div></aside>
  </form>
 </div>;
}
