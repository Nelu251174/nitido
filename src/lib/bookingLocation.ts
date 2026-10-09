export function localityFromGpsResponse(value:unknown):string {
 if(!value||typeof value!=='object')throw new Error('Localitatea nu a putut fi identificată. Completează manual.');
 const data=value as Record<string,unknown>;
 if(data.countryCode!=='RO')throw new Error('Locația detectată este în afara României. Introdu localitatea lucrării din România.');
 const city=typeof data.city==='string'&&data.city.trim()?data.city:data.locality;
 if(typeof city!=='string'||!city.trim())throw new Error('Localitatea nu a putut fi identificată. Completează manual.');
 // București districts must match firms covering the city, not a district name.
 if(data.principalSubdivisionCode==='RO-B'||/^Bucharest$|^Bucure[șşs]ti$|^Sector\s+[1-6]$/i.test(city))return 'București';
 return city.trim().slice(0,100);
}
export async function currentBookingCity(signal:AbortSignal):Promise<string>{
 const {Capacitor}=await import('@capacitor/core');
 if(Capacitor.isNativePlatform()&&!Capacitor.isPluginAvailable('Geolocation'))throw new Error('Pentru localizare automată, instalează noua versiune NITIDO. Poți completa localitatea manual.');
 const {Geolocation}=await import('@capacitor/geolocation');
 const position=await Geolocation.getCurrentPosition({enableHighAccuracy:true,timeout:12000,maximumAge:0}).catch((error:unknown)=>{
  const code=error&&typeof error==='object'&&'code' in error?error.code:undefined;
  if(code===1||code==='OS-PLUG-GLOC-0003')throw new Error('Accesul la locație nu este permis. Poți activa permisiunea din setările aplicației sau completa localitatea manual.');
  throw new Error('GPS-ul nu răspunde. Încearcă din nou sau completează localitatea manual.');
 });
 if(signal.aborted)throw new DOMException('Aborted','AbortError');
 const {latitude,longitude,accuracy}=position.coords;
 if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||!Number.isFinite(accuracy)||accuracy>5000)throw new Error('Semnalul GPS nu este suficient de precis. Încearcă din nou sau completează manual.');
 // Device coordinates only, sent directly by the browser as required by the provider.
 // No IP fallback, background tracking, server logs or persisted coordinates.
 const params=new URLSearchParams({latitude:String(latitude),longitude:String(longitude),localityLanguage:'ro'});
 const response=await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?${params}`,{signal:AbortSignal.any([signal,AbortSignal.timeout(10000)]),credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store'});
 if(!response.ok)throw new Error('Serviciul de localizare nu răspunde. Completează localitatea manual.');
 return localityFromGpsResponse(await response.json());
}
