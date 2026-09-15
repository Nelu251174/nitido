export type BookingAddress={city:string;street:string;postalCode:string};
type Component={long_name?:string;short_name?:string;types?:string[]};
type Result={address_components?:Component[];geometry?:{location_type?:string};types?:string[]};
export function addressFromGoogle(data:unknown):BookingAddress{
 const payload=data as {status?:string;results?:Result[]};
 if(payload?.status!=='OK'||!Array.isArray(payload.results))throw new Error('Adresa nu a putut fi identificată. Completează manual.');
 for(const r of payload.results){
  if(!Array.isArray(r.address_components))continue;
  const part=(type:string,short=false)=>{const c=r.address_components!.find(c=>c.types?.includes(type));return (short?c?.short_name:c?.long_name)?.trim()??''};
  if(part('country',true)!=='RO')continue;
  let city=part('locality')||part('postal_town');
  if(/^Bucharest$|^Bucure[șşs]ti$|^Sector\s+[1-6]$/i.test(city))city='București';
  const road=part('route'),number=part('street_number');
  // Never invent a house number from approximate/interpolated geography.
  const exact=r.geometry?.location_type==='ROOFTOP';
  if(!city||!road)continue;
  const postal=part('postal_code');
  return {city:city.slice(0,100),street:[road,exact?number:''].filter(Boolean).join(' ').slice(0,250),postalCode:/^\d{6}$/.test(postal)?postal:''};
 }
 throw new Error('Nu am găsit o adresă stradală din România. Completează manual.');
}
export function validAddressPosition(value:unknown):value is {latitude:number;longitude:number;accuracy:number}{
 if(!value||typeof value!=='object')return false;
 const {latitude,longitude,accuracy}=value as Record<string,unknown>;
 return typeof latitude==='number'&&Number.isFinite(latitude)&&latitude>=-90&&latitude<=90&&typeof longitude==='number'&&Number.isFinite(longitude)&&longitude>=-180&&longitude<=180&&typeof accuracy==='number'&&Number.isFinite(accuracy)&&accuracy>=0&&accuracy<=100;
}
