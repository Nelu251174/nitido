'use client';

import {useEffect,useRef,useState} from 'react';
import {useLocale} from 'next-intl';
import Link from 'next/link';
import {LanguageSelector} from './LanguageSelector';
import {UiElement,UiText} from '@/components/UiText';
import {InternationalBookingLocation} from './InternationalBookingLocation';
import type {InternationalLocation} from '@/lib/internationalBookingLocation';
import styles from './InternationalTariffReview.module.css';

type Market={code:string;name:string;timeZone:string;cities:{key:string;name:string}[]};
type Context={countryCode:string;city:string;spaceType:string;service:string;sqm:number;requestedDurationMinutes?:number};
type Pricing={currency:'EUR';countryCode:string;city:string;durationMinutes:number;workers:number;personMinutes:number;netMinor:number;vatMinor:number;vatBps:number;clientTotalMinor:number;lines:{code:string;amountMinor:number}[]};
type Quote={id:string;expiresAt:string;context:Context;pricing:Pricing};
type Booking={id?:string;jobId?:string;status?:string};
const spaces=[['apartament','Apartament'],['casa','Casă'],['birou','Birou']] as const;
const services=[['maintenance','Întreținere'],['general','Curățenie generală'],['renovation','După renovare']] as const;
function Badge({children,tone='neutral'}:{children:React.ReactNode;tone?:'neutral'|'good'}){return <span className={`${styles.badge} ${styles[tone]}`}>{children}</span>;}

export function InternationalBooking({markets,initialCountryCode,initialVisitorCountry=null}:{markets:Market[];initialCountryCode?:string;initialVisitorCountry?:string|null}){
 const locale=useLocale(),countryEdited=useRef(false);
 const euro=(minor:number)=>Number.isInteger(minor)?new Intl.NumberFormat(locale,{style:'currency',currency:'EUR'}).format(minor/100):'—';
 const [countryCode,setCountryCode]=useState(()=>markets.some(x=>x.code===initialCountryCode)?initialCountryCode!:''),[cityKey,setCityKey]=useState(''),[spaceType,setSpaceType]=useState('apartament'),[service,setService]=useState('maintenance'),[sqm,setSqm]=useState(''),[hours,setHours]=useState('3');
 const [street,setStreet]=useState(''),[postalCode,setPostalCode]=useState(''),[floor,setFloor]=useState(''),[scheduledAt,setScheduledAt]=useState(''),[accepted,setAccepted]=useState(false);
 const [quote,setQuote]=useState<Quote|null>(null),[booking,setBooking]=useState<Booking|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[status,setStatus]=useState(''),[visitorCountry,setVisitorCountry]=useState<string|null>(initialVisitorCountry);
 const market=markets.find(x=>x.code===countryCode),city=market?.cities.find(x=>x.key===cityKey)??market?.cities[0];
 useEffect(()=>{const abort=new AbortController();fetch('/api/visitor-context',{signal:abort.signal,cache:'no-store'}).then(r=>r.ok?r.json():null).then((d:{country?:string}|null)=>{if(abort.signal.aborted||!d?.country)return;setVisitorCountry(d.country);if(!countryEdited.current&&initialCountryCode===undefined&&markets.some(x=>x.code===d.country))setCountryCode(current=>current||d.country!);}).catch(()=>{});return()=>abort.abort();},[markets,initialCountryCode]);
 function invalidate(){setQuote(null);setAccepted(false);setError('');setStatus('');}
 function acceptLocation(address:InternationalLocation){
  const detectedMarket=markets.find(x=>x.code===address.countryCode),detectedCity=detectedMarket?.cities.find(x=>x.key===address.city);
  if(!detectedMarket||!detectedCity){setError('Orașul nu are o piață configurată.');return;}
  const samePlace=countryCode===address.countryCode&&city?.key===address.city;
  const nextStreet=address.street||(samePlace?street:''),nextPostalCode=address.postalCode||(samePlace?postalCode:'');
  countryEdited.current=true;setCountryCode(address.countryCode);setCityKey(address.city);
  setStreet(nextStreet);setPostalCode(nextPostalCode);
  if(!samePlace||nextStreet!==street||nextPostalCode!==postalCode){setFloor('');setScheduledAt('');}
  invalidate();
 }
 async function requestQuote(){
  invalidate();if(!market||!city){setError('Alege țara și orașul în care se face curățenia.');return;}
  if(!Number.isFinite(Number(sqm))||Number(sqm)<=0||!Number.isFinite(Number(hours))||Number(hours)<3){setError('Completează o suprafață validă și o durată de minimum trei ore.');return;}
  setBusy(true);try{
   const context:Context={countryCode:market.code,city:city.key,spaceType,service,sqm:Number(sqm),requestedDurationMinutes:Math.round(Number(hours)*60)};
   const r=await fetch('/api/international/quote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(context)});const d=await r.json().catch(()=>({})) as {error?:string;quote?:Quote};
   if(!r.ok)throw Error(d.error??'Oferta nu poate fi calculată pentru această localitate.');
   if(!d.quote||d.quote.pricing?.currency!=='EUR'||!d.quote.context||!Number.isSafeInteger(d.quote.pricing.clientTotalMinor))throw Error('Oferta nu a putut fi confirmată. Nicio plată nu a fost inițiată.');
   setQuote(d.quote);setStatus('Oferta este calculată pe server. Verifică totalul și condițiile înainte să trimiți cererea.');
  }catch(e){setError(e instanceof Error?e.message:'Oferta nu este disponibilă.');}finally{setBusy(false);}
 }
 async function submitBooking(){
  setError('');setStatus('');if(!quote||booking||busy)return;
  if(Date.parse(quote.expiresAt)<=Date.now()){invalidate();setError('Oferta a expirat. Verifică din nou prețul înainte de a continua.');return;}
  if(!accepted||!street.trim()||!scheduledAt){setError('Completează adresa și data, apoi confirmă oferta afișată.');return;}
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(scheduledAt)){setError('Alege o dată și o oră locală valide pentru lucrare.');return;}
  setBusy(true);try{
   const r=await fetch('/api/international/bookings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({quoteId:quote.id,context:quote.context,street:street.trim(),...(postalCode.trim()?{postalCode:postalCode.trim()}:{}),...(floor.trim()?{floor:floor.trim()}:{}),scheduledLocal:scheduledAt})});
   const d=await r.json().catch(()=>({})) as {error?:string;booking?:Booking;job?:Booking;id?:string;jobId?:string};if(!r.ok)throw Error(d.error??'Cererea nu a putut fi confirmată.');
   const saved=d.booking??d.job??d;if(!saved.id&&!saved.jobId)throw Error('Confirmarea cererii nu a fost primită. Nu retrimite înainte de verificarea rezervărilor.');
   setBooking(saved);setStatus('Cererea a fost înregistrată. Trimiterea cererii nu a inițiat o plată.');
  }catch(e){setError(e instanceof Error?e.message:'Cererea nu a putut fi confirmată.');}finally{setBusy(false);}
 }
 return <div className={`${styles.root} ${styles.clientPreview}`} data-international-review><header className={styles.previewHeader}><Link href="/client" className={styles.brand}><UiText text={"NÍTIDO"}/><span><UiText text={".RO"}/></span></Link><div><Link className={styles.backLink} href="/client"><UiText text="Contul meu"/></Link><LanguageSelector/></div></header><main className={styles.previewMain}>
  <div className={styles.previewIntro}><span className={styles.eyebrow}><UiText text="CURĂȚENIE LA ADRESA TA"/></span><h1><UiText text="Locul potrivit. Un preț explicat."/></h1><p><UiText text="Alegi unde se face curățenia. Prețul și moneda sunt stabilite pentru țara lucrării, indiferent de limba site-ului."/></p></div>
  <p className={styles.notice}><UiText text="Pentru o lucrare în România, folosește oferta existentă."/> <Link href="/rezervare?countryCode=RO"><UiText text="Rezervă în România"/> ↗</Link></p>
  <div className={styles.clientGrid}><section className={styles.clientForm}><fieldset className={styles.draftFields} disabled={busy||Boolean(booking)}><legend className={styles.srOnly}><UiText text="Datele lucrării"/></legend><div className={styles.formTitle}><span>1</span><div><h2><UiText text="Unde se face curățenia?"/></h2><p><UiText text="Țara conexiunii este doar o sugestie. Confirmă adresa lucrării."/>{visitorCountry&&<> ({visitorCountry})</>}</p></div></div>
   <InternationalBookingLocation key={countryCode+'|'+(city?.key??'')} location={{countryCode,city:city?.key??'',street,postalCode}} contextKey={JSON.stringify({floor,scheduledAt})} enabled={!busy&&!booking} onLocate={()=>{countryEdited.current=true;}} onDetected={acceptLocation}/>
   <div className={styles.formGrid}><label><UiText text="Țara lucrării"/><UiElement as="select" aria-label="Țara lucrării" value={countryCode} onChange={e=>{countryEdited.current=true;setCountryCode(e.target.value);setCityKey('');setStreet('');setPostalCode('');setFloor('');invalidate();}}><option value=""><UiText text="Alege țara"/></option>{markets.map(x=><option key={x.code} value={x.code}>{x.name}</option>)}</UiElement></label><label><UiText text="Oraș"/><UiElement as="select" aria-label="Oraș" disabled={!market} value={city?.key??''} onChange={e=>{countryEdited.current=true;setCityKey(e.target.value);setStreet('');setPostalCode('');setFloor('');invalidate();}}>{!market&&<option value=""><UiText text="Alege mai întâi țara"/></option>}{market?.cities.map(x=><option key={x.key} value={x.key}>{x.name}</option>)}</UiElement></label></div>
   <div className={styles.formTitle}><span>2</span><div><h2><UiText text="Ce fel de curățenie îți dorești?"/></h2><p><UiText text="Oferta include echipa și minimumul de timp necesar."/></p></div></div><div className={styles.formGrid}><label><UiText text="Tip spațiu"/><UiElement as="select" value={spaceType} onChange={e=>{setSpaceType(e.target.value);invalidate();}}>{spaces.map(([key,label])=><option key={key} value={key}><UiText text={label}/></option>)}</UiElement></label><label><UiText text="Tip curățenie"/><UiElement as="select" value={service} onChange={e=>{setService(e.target.value);invalidate();}}>{services.map(([key,label])=><option key={key} value={key}><UiText text={label}/></option>)}</UiElement></label><label><UiText text="Suprafață (m²)"/><UiElement as="input" type="number" min="1" value={sqm} onChange={e=>{setSqm(e.target.value);invalidate();}} placeholder="Suprafața spațiului"/></label><label><UiText text="Durată dorită (ore)"/><input type="number" min="3" step="0.5" value={hours} onChange={e=>{setHours(e.target.value);invalidate();}}/></label></div><button type="button" className={styles.primaryButton} disabled={busy} onClick={()=>void requestQuote()}><UiText text={busy?'Se verifică…':'Verifică prețul'}/><span aria-hidden="true">→</span></button>
   {quote&&<><div className={styles.formTitle}><span>3</span><div><h2><UiText text="Adresa și programul lucrării"/></h2><p><UiText text="Confirmi oferta înainte să trimiți cererea."/></p></div></div><div className={styles.formGrid}><label><UiText text="Stradă și număr"/><UiElement as="input" autoComplete="street-address" value={street} onChange={e=>setStreet(e.target.value)} placeholder="Adresa lucrării"/></label><label><UiText text="Cod poștal (opțional)"/><input autoComplete="postal-code" value={postalCode} onChange={e=>setPostalCode(e.target.value)}/></label><label><UiText text="Etaj (opțional)"/><input value={floor} onChange={e=>setFloor(e.target.value)}/></label><label><UiText text="Data și ora locală a lucrării"/><UiElement as="input" aria-label="Data și ora locală a lucrării" type="datetime-local" value={scheduledAt} onChange={e=>setScheduledAt(e.target.value)}/><small>{market?.timeZone}</small></label></div><div className={styles.checks}><label><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)}/><UiText text="Am verificat totalul în EUR, echipa și condițiile ofertei."/></label></div><button type="button" className={styles.primaryButton} disabled={busy||!accepted} onClick={()=>void submitBooking()}><UiText text={busy?'Se înregistrează…':'Trimite cererea de curățenie'}/><span aria-hidden="true">→</span></button></>}
  </fieldset>{error&&<p className={styles.error} role="alert"><UiText text={error}/></p>}{status&&<p className={styles.notice} role="status"><UiText text={status}/></p>}{booking&&<div className={styles.notice}><strong><UiText text="Cerere înregistrată"/></strong><p><UiText text="Referință"/>: {booking.id??booking.jobId}</p><Link href="/client"><UiText text="Înapoi în cont"/> →</Link></div>}</section>
  <aside className={styles.quotePanel}><Badge tone={quote?'good':'neutral'}><UiText text={quote?'Ofertă calculată pe server':'Preț după verificarea pieței'}/></Badge><h2><UiText text="Totul la vedere."/></h2><dl><div><dt><UiText text="Localitate"/></dt><dd>{city?`${city.name}, ${market?.name}`:<UiText text="Încă nealeasă"/>}</dd></div><div><dt><UiText text="Moneda debitării"/></dt><dd><UiText text={"EUR"}/></dd></div>{quote?<><div><dt><UiText text="Bază netă"/></dt><dd>{euro(quote.pricing.netMinor)}</dd></div><div><dt><UiText text="TVA"/></dt><dd>{euro(quote.pricing.vatMinor)}</dd></div><div><dt><UiText text="Total final"/></dt><dd>{euro(quote.pricing.clientTotalMinor)}</dd></div></>:<div><dt><UiText text="Total final"/></dt><dd className={styles.pendingPrice}><UiText text="De verificat"/></dd></div>}</dl>{quote?<><p className={styles.hoursNote}>{quote.pricing.durationMinutes/60} <UiText text="ore de prezență"/> × {quote.pricing.workers} <UiText text="lucrători"/> = {quote.pricing.personMinutes/60} <UiText text="ore de muncă"/>.</p><p className={styles.sourceDate}><UiText text="Oferta expiră"/>: {new Intl.DateTimeFormat(locale,{dateStyle:'short',timeStyle:'short',timeZone:market?.timeZone??'UTC'}).format(new Date(quote.expiresAt))}</p></>:<p className={styles.disclaimer}><UiText text="Dacă tariful local nu este aprobat sau datele sunt incomplete, nu afișăm un preț și nu permitem rezervarea."/></p>}<div className={styles.quoteDivider}/><h3><UiText text="Un preț local, nu o simplă conversie."/></h3><p className={styles.disclaimer}><UiText text="Schimbarea limbii nu schimbă țara lucrării, tariful sau moneda debitării. Trimiterea cererii nu încasează bani."/></p></aside></div>
 </main></div>;
}
