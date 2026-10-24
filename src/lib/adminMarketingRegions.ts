// Marketing geography: București is an independent administrative group, separate from Ilfov.
export const MARKETING_REGIONS = [
 ['AB','Alba'],['AR','Arad'],['AG','Argeș'],['BC','Bacău'],['BH','Bihor'],['BN','Bistrița-Năsăud'],['BT','Botoșani'],['BV','Brașov'],['BR','Brăila'],['B','București'],['BZ','Buzău'],['CS','Caraș-Severin'],['CL','Călărași'],['CJ','Cluj'],['CT','Constanța'],['CV','Covasna'],['DB','Dâmbovița'],['DJ','Dolj'],['GL','Galați'],['GR','Giurgiu'],['GJ','Gorj'],['HR','Harghita'],['HD','Hunedoara'],['IL','Ialomița'],['IS','Iași'],['IF','Ilfov'],['MM','Maramureș'],['MH','Mehedinți'],['MS','Mureș'],['NT','Neamț'],['OT','Olt'],['PH','Prahova'],['SM','Satu Mare'],['SJ','Sălaj'],['SB','Sibiu'],['SV','Suceava'],['TR','Teleorman'],['TM','Timiș'],['TL','Tulcea'],['VS','Vaslui'],['VL','Vâlcea'],['VN','Vrancea'],
].map(([code,name])=>({code,name,key:name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(),iso:'RO-'+code}));
export const MARKETING_COUNTY_ORDER = ['CT','B',...MARKETING_REGIONS.map(r=>r.code).filter(code=>!['CT','B'].includes(code))];
export function marketingRegion(value:unknown){
 if(typeof value!=='string')return undefined;
 const normalized=value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ş/g,'s').replace(/ţ/g,'t').toLowerCase().trim().replace(/^(judetul|judet|municipiul)\s+/,'');
 return MARKETING_REGIONS.find(r=>r.key===normalized||r.code.toLowerCase()===normalized||r.iso.toLowerCase()===normalized);
}
export function inferMarketingCounty(city:string){
 const key=city.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 const known:Record<string,string>={'constanta':'CT','bucuresti':'B','cluj-napoca':'CJ','timisoara':'TM','iasi':'IS','brasov':'BV','oradea':'BH','sibiu':'SB'};
 return marketingRegion(known[key]??'');
}
export const MARKETING_EMAIL_VERIFICATIONS={pending:'Neverificat',verified:'Sursă și domeniu verificate',invalid:'Adresă invalidă',needs_review:'Necesită verificare'} as const;
export type MarketingEmailVerification=keyof typeof MARKETING_EMAIL_VERIFICATIONS;
