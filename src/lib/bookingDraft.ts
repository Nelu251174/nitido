import {bookingDateKey} from './scheduling';
import {SLOT_HOURS,type SpaceType} from './pricing';

export interface BookingDraft {
 street:string;postalCode:string;city:string;floor:string;details:string;
 sqm:number;spaceType:SpaceType;whenType:'asap'|'scheduled';mode:'standard'|'express';express60:boolean;
 scheduledDate:string;scheduledHour:number|null;propertyId:string|null;approvalId:string|null;
 photos:{id:string;url:string;room:string|null}[];
}
type DraftStorage=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
const KEY='nitido:card-booking-draft:v1';
export const BOOKING_DRAFT_TTL=30*60*1000;
const record=(value:unknown):value is Record<string,unknown>=>typeof value==='object'&&value!==null&&!Array.isArray(value);
const bounded=(value:unknown,max:number):value is string=>typeof value==='string'&&value.length<=max;
const id=(value:unknown):value is string=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(value);
const nullableId=(value:unknown)=>value===null||id(value);

function decode(raw:string|null,userId:string,now:number):BookingDraft|null{
 if(!raw||raw.length>40000)return null;
 try{
  const envelope:unknown=JSON.parse(raw);
  if(!record(envelope)||envelope.version!==1||envelope.userId!==userId||typeof envelope.savedAt!=='number'||!Number.isFinite(envelope.savedAt)||now<envelope.savedAt||now-envelope.savedAt>BOOKING_DRAFT_TTL)return null;
  const d=envelope.draft;
  if(!record(d)||!bounded(d.street,500)||!bounded(d.postalCode,30)||!bounded(d.city,100)||!bounded(d.floor,100)||!bounded(d.details,10000))return null;
  if(typeof d.sqm!=='number'||!Number.isInteger(d.sqm)||d.sqm<1||d.sqm>1000||!['apartament','casa','birou','altul'].includes(String(d.spaceType)))return null;
  if(!['asap','scheduled'].includes(String(d.whenType))||!['standard','express'].includes(String(d.mode))||typeof d.express60!=='boolean')return null;
  if(typeof d.scheduledDate!=='string'||bookingDateKey(d.scheduledDate)!==d.scheduledDate||(d.scheduledHour!==null&&!(SLOT_HOURS as readonly unknown[]).includes(d.scheduledHour)))return null;
  if(!nullableId(d.propertyId)||!nullableId(d.approvalId)||!Array.isArray(d.photos)||d.photos.length>5)return null;
  const photos:BookingDraft['photos']=[];
  for(const p of d.photos){if(!record(p)||!id(p.id)||(p.room!==null&&!bounded(p.room,100)))return null;photos.push({id:p.id,url:`/api/uploads/${p.id}`,room:p.room as string|null});}
  // Reconstruct explicitly: never restore prices, card state, arbitrary image URLs or authorization.
  return {street:d.street,postalCode:d.postalCode,city:d.city,floor:d.floor,details:d.details,sqm:d.sqm,spaceType:d.spaceType as SpaceType,whenType:d.whenType as BookingDraft['whenType'],mode:d.mode as BookingDraft['mode'],express60:d.express60,scheduledDate:d.scheduledDate,scheduledHour:d.scheduledHour as number|null,propertyId:d.propertyId as string|null,approvalId:d.approvalId as string|null,photos};
 }catch{return null;}
}

export function saveBookingDraft(storage:DraftStorage,userId:string,draft:BookingDraft,now=Date.now()):boolean{
 try{const raw=JSON.stringify({version:1,userId,savedAt:now,draft});if(!userId||!decode(raw,userId,now))return false;storage.setItem(KEY,raw);return true;}catch{return false;}
}
export function takeBookingDraft(storage:DraftStorage,userId:string,now=Date.now()):BookingDraft|null{
 try{const raw=storage.getItem(KEY);storage.removeItem(KEY);return decode(raw,userId,now);}catch{return null;}
}
export function clearBookingDraft(storage:DraftStorage):void{try{storage.removeItem(KEY);}catch{/* Storage may be disabled. */}}
