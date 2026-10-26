import type {SpaceType} from './pricing';
export type AutomaticCleaningType='maintenance'|'general';
export type CleaningType=AutomaticCleaningType|'renovation';
export const CLEANING_TYPES=[['maintenance','Întreținere'],['general','Curățenie generală'],['renovation','După constructor / renovare']] as const;
export const MAINTENANCE_TIERS=[{max:40,price:400},{max:60,price:550},{max:80,price:700},{max:100,price:850}];
export const MAINTENANCE_OVERFLOW_RATE_LEI=8.5;
export const MAINTENANCE_RATES:Record<Exclude<SpaceType,'apartament'>,number>={casa:8,birou:6,altul:7};
export const MAINTENANCE_MINIMUMS={casa:400,birou:300,altul:350};
export function validCleaningType(v:unknown):v is CleaningType{return CLEANING_TYPES.some(([key])=>key===v);}
export function validAutomaticCleaningType(v:unknown):v is AutomaticCleaningType{return v==='maintenance'||v==='general';}
export const CLEANING_SCOPE={
 maintenance:[{key:'surfaces',label:'Ștergere praf pe suprafețe accesibile'},{key:'floors',label:'Aspirare și spălare pardoseli'},{key:'sanitary',label:'Întreținere ușoară a unei băi și a unei bucătării'},{key:'inspection',label:'Golire coșuri menajere și verificare finală'}],
 general:[{key:'surfaces',label:'Ștergere praf pe suprafețe accesibile'},{key:'fronts',label:'Curățare fronturi exterioare și mânere'},{key:'details',label:'Plinte accesibile, întrerupătoare și mânere'},{key:'sanitary',label:'Curățare detaliată a unei băi și a unei bucătării'},{key:'floors',label:'Aspirare și spălare pardoseli'},{key:'inspection',label:'Golire coșuri menajere și verificare finală'}],
} as const;
export const CLEANING_DESCRIPTION={maintenance:'Pentru spații întreținute regulat, cu murdărie ușoară.',general:'Curățenie detaliată, pentru murdărie obișnuită acumulată.',renovation:'Praf fin, urme de vopsea, ciment sau adeziv: ofertă după evaluare.'};
export const CLEANING_EXCLUSIONS={maintenance:'Fără depuneri persistente, degresare intensă sau resturi de renovare.',general:'Interiorul electrocasnicelor, murdăria dificilă și resturile de renovare necesită evaluare.'};
export function cleaningAssessmentUrl(city:string,sqm:string|number){return '/client/evaluari?'+new URLSearchParams({category:'renovation',city,sqm:String(sqm)});}
