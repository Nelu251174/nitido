import {validEntrance,type Entrance} from "./entrance";
import {bookingDateKey} from './scheduling';
import {SLOT_HOURS,validWindowsSqm,type SpaceType} from './pricing';

export interface BookingDraft {
 street:string;postalCode:string;city:string;floor:string;details:string;
 entrance?:Entrance;
 windowsSqm?:number;
 sqm:number;spaceType:SpaceType;whenType:'asap'|'scheduled';mode:'standard'|'express';express60:boolean;
 scheduledDate:string;scheduledHour:number|null;propertyId:string|null;approvalId:string|null;
 cardId?:string|null;hostEventId?:string|null;hostRevision?:string|null;
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
  if(record(d)&&d.windowsSqm!==undefined&&!validWindowsSqm(d.windowsSqm))return null;
  if(!record(d)||!bounded(d.street,500)||!bounded(d.postalCode,30)||!bounded(d.city,100)||!bounded(d.floor,100)||!bounded(d.details,10000))return null;
  if(typeof d.sqm!=='number'||!Number.isInteger(d.sqm)||d.sqm<1||d.sqm>1000||!['apartament','casa','birou','altul'].includes(String(d.spaceType)))return null;
  if(!['asap','scheduled'].includes(String(d.whenType))||!['standard','express'].includes(String(d.mode))||typeof d.express60!=='boolean')return null;
  if(typeof d.scheduledDate!=='string'||bookingDateKey(d.scheduledDate)!==d.scheduledDate||(d.scheduledHour!==null&&!(SLOT_HOURS as readonly unknown[]).includes(d.scheduledHour)))return null;
  if(!nullableId(d.propertyId)||!nullableId(d.approvalId)||!Array.isArray(d.photos)||d.photos.length>5)return null;
  if(d.cardId!==undefined&&!nullableId(d.cardId))return null;
  if(d.hostEventId!==undefined&&!nullableId(d.hostEventId))return null;
  if(d.hostRevision!==undefined&&d.hostRevision!==null&&(typeof d.hostRevision!=='string'||!/^[a-f0-9]{64}$/.test(d.hostRevision)))return null;
  const photos:BookingDraft['photos']=[];
  for(const p of d.photos){if(!record(p)||!id(p.id)||(p.room!==null&&!bounded(p.room,100)))return null;photos.push({id:p.id,url:`/api/uploads/${p.id}`,room:p.room as string|null});}
  // Reconstruct explicitly: never restore prices, card state, arbitrary image URLs or authorization.
  return {...(validEntrance(d.entrance,{street:d.street,city:d.city,postalCode:d.postalCode})?{entrance:d.entrance}:{}),street:d.street,postalCode:d.postalCode,city:d.city,floor:d.floor,details:d.details,sqm:d.sqm,windowsSqm:typeof d.windowsSqm==='number'?d.windowsSqm:0,spaceType:d.spaceType as SpaceType,whenType:d.whenType as BookingDraft['whenType'],mode:d.mode as BookingDraft['mode'],express60:d.express60,scheduledDate:d.scheduledDate,scheduledHour:d.scheduledHour as number|null,propertyId:d.propertyId as string|null,approvalId:d.approvalId as string|null,photos,...(d.hostEventId!==undefined?{hostEventId:d.hostEventId as string|null}:{}),...(d.hostRevision!==undefined?{hostRevision:d.hostRevision as string|null}:{}),...(d.cardId!==undefined?{cardId:d.cardId as string|null}:{})};
 }catch{return null;}
}

export function saveBookingDraft(storage:DraftStorage,userId:string,draft:BookingDraft,now=Date.now()):boolean{
 try{const raw=JSON.stringify({version:1,userId,savedAt:now,draft});if(!userId||!decode(raw,userId,now))return false;storage.setItem(KEY,raw);return true;}catch{return false;}
}
export function takeBookingDraft(storage:DraftStorage,userId:string,now=Date.now()):BookingDraft|null{
 try{const raw=storage.getItem(KEY);storage.removeItem(KEY);return decode(raw,userId,now);}catch{return null;}
}
export function clearBookingDraft(storage:DraftStorage):void{try{storage.removeItem(KEY);}catch{/* Storage may be disabled. */}}
