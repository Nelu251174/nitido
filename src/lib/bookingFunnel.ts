"use client";
import {adsAllowed} from './googleAds';
export type BookingFunnelEvent='start'|'space_valid'|'schedule_valid'|'summary_view'|'account_requested'|'field_error';
/** No booking values or URL query strings. One event per session, step and error category. */
export function trackBookingFunnel(event:BookingFunnelEvent,field?:string){
 if(!adsAllowed())return;
 try{
  let session=sessionStorage.getItem('nitido.funnel-session.v1');
  if(!session){session=crypto.randomUUID();sessionStorage.setItem('nitido.funnel-session.v1',session);}
  const key='nitido.funnel-event.v1:'+event+':'+(field??'');
  if(sessionStorage.getItem(key))return;
  sessionStorage.setItem(key,'pending');
  void fetch('/api/booking-funnel',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'omit',keepalive:true,body:JSON.stringify({session,event,field,device:window.matchMedia('(max-width:760px)').matches?'mobile':'desktop',consent:true})}).then(r=>{if(r.ok)sessionStorage.setItem(key,'sent');else sessionStorage.removeItem(key);}).catch(()=>sessionStorage.removeItem(key));
 }catch{ /* Optional measurement must never block a booking. */ }
}
