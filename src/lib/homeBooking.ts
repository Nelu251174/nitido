import type {SpaceType} from './pricing';
export type OwnedHome={id:string;name:string;city:string;street:string;postal_code:string;floor:string;sqm:number;space_type:string;bathroom_count:number|null;notes?:string;sensitive_materials?:string;usual_tasks?:string;access_notes?:string};
/** A new booking snapshot. Never writes back to the saved property or old jobs. */
export function homeBookingValues(home:OwnedHome,overrides:Record<string,string>={}){
 const area=Number(overrides.sqm),baths=Number(overrides.bathroomCount);
 return {street:home.street,postalCode:home.postal_code??'',floor:home.floor??'',city:overrides.city?.trim()||home.city,sqm:Number.isInteger(area)&&area>=10&&area<=1000?area:home.sqm,
 spaceType:(['apartament','casa','birou','altul'].includes(overrides.spaceType)?overrides.spaceType:home.space_type) as SpaceType,
 bathroomCount:overrides.bathroomCount!==undefined&&Number.isInteger(baths)&&baths>=0&&baths<=20?baths:home.bathroom_count??1,
 details:[home.notes,home.sensitive_materials&&`Materiale sensibile: ${home.sensitive_materials}`,home.usual_tasks&&`Sarcini uzuale: ${home.usual_tasks}`].filter(Boolean).join('\n')};
}
