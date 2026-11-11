import {validAddressPosition} from './bookingAddress';
import {internationalLocalityFromResponse,type InternationalLocation} from './internationalBookingLocation';

/** Device coordinates are transient; never use the connection IP as a street address. */
export async function currentInternationalLocation(addressConfigured:boolean,signal:AbortSignal):Promise<InternationalLocation>{
 if(signal.aborted)throw new DOMException('Aborted','AbortError');
 const {Capacitor}=await import('@capacitor/core');
 if(Capacitor.isNativePlatform()&&!Capacitor.isPluginAvailable('Geolocation'))throw Error('Actualizează NITIDO pentru localizare sau completează adresa manual.');
 const {Geolocation}=await import('@capacitor/geolocation');
 const p=await Geolocation.getCurrentPosition({enableHighAccuracy:true,timeout:12000,maximumAge:0}).catch((error:unknown)=>{
  const code=error&&typeof error==='object'&&'code' in error?error.code:undefined;
  if(code===1||code==='OS-PLUG-GLOC-0003')throw Error('Accesul la locație nu este permis. Poți activa permisiunea din setările aplicației sau completa localitatea manual.');
  throw Error('GPS-ul nu răspunde. Încearcă din nou sau completează localitatea manual.');
 });
 if(signal.aborted)throw new DOMException('Aborted','AbortError');
 const coords={latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy};
 const usableLocality=validAddressPosition({...coords,accuracy:0})&&Number.isFinite(coords.accuracy)&&coords.accuracy>=0&&coords.accuracy<=5000;
 if(addressConfigured?!validAddressPosition(coords):!usableLocality)throw Error('Localizarea nu este suficient de precisă. Încearcă lângă o fereastră sau completează manual.');
 if(addressConfigured){
  const r=await fetch('/api/international/location',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(coords),cache:'no-store',signal});
  const d=await r.json();if(!r.ok)throw Error(d.error||'Adresa nu a putut fi identificată. Completează manual.');
  const a=d.address as InternationalLocation;
  // Do not turn a malformed provider/server result into a selectable default city.
  const place=internationalLocalityFromResponse(a);
  if(typeof a.street!=='string'||!a.street.trim()||a.street.length>250||typeof a.postalCode!=='string'||a.postalCode.length>20)throw Error('Adresa nu a putut fi identificată. Completează manual.');
  return {...place,street:a.street,postalCode:a.postalCode};
 }
 const params=new URLSearchParams({latitude:String(coords.latitude),longitude:String(coords.longitude),localityLanguage:'en'});
 const r=await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?${params}`,{credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store',signal:AbortSignal.any([signal,AbortSignal.timeout(10000)])});
 if(!r.ok)throw Error('Serviciul de localizare nu răspunde. Completează localitatea manual.');
 return internationalLocalityFromResponse(await r.json());
}
