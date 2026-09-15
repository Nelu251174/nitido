export type EntranceAddress = {street:string;city:string;postalCode?:string|null};
export type Entrance = {lat:number;lng:number;confirmed:true;addressKey:string};
export function entranceAddressKey(address:EntranceAddress){
 return JSON.stringify([address.street,address.city,address.postalCode??''].map(s=>s.trim().toLocaleLowerCase('ro-RO')));
}
export function validEntrance(value:unknown,address:EntranceAddress):value is Entrance{
 if(!value||typeof value!=='object'||typeof address.street!=='string'||typeof address.city!=='string'||(address.postalCode!=null&&typeof address.postalCode!=='string'))return false;
 const p=value as Partial<Entrance>;
 return p.confirmed===true&&typeof p.lat==='number'&&Number.isFinite(p.lat)&&Math.abs(p.lat)<=90&&typeof p.lng==='number'&&Number.isFinite(p.lng)&&Math.abs(p.lng)<=180&&p.addressKey===entranceAddressKey(address);
}
export const JOB_NAVIGATION_SCHEMA=`CREATE TABLE IF NOT EXISTS job_navigation (
 job_id TEXT PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
 latitude REAL NOT NULL CHECK(latitude BETWEEN -90 AND 90),
 longitude REAL NOT NULL CHECK(longitude BETWEEN -180 AND 180),
 confirmed_at TEXT NOT NULL
);`;
