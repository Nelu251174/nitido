import type Database from 'better-sqlite3';
import {randomUUID} from 'node:crypto';
import researchManifest from '@/data/internationalResearchReview.json';
import {serviceCountry,type ServiceCountry} from './serviceMarkets';
import {internationalReviewEnabled} from './internationalRollout';
export {internationalReviewEnabled} from './internationalRollout';

export type InternationalCountry=Exclude<ServiceCountry,'RO'>;
export type InternationalStatus='draft'|'evidence'|'approved'|'active';
export type InternationalSpace='apartament'|'casa'|'birou'|'altul';
export type InternationalService='maintenance'|'general'|'renovation';
export type InternationalRateUnit='worker_hour'|'team_hour'|'m2'|'visit';
export class InternationalTariffError extends Error{constructor(message:string,public status=400){super(message);}}
const fail=(message:string,status=400):never=>{throw new InternationalTariffError(message,status);};
type ResearchCountry={code:string;name:string;cities:{id:string;cityKey:string;name:string;gaps:string[];sources:unknown[];publishedCount:number;completeCount:number}[]};
const research=researchManifest as unknown as {countries:ResearchCountry[]};
export const INTERNATIONAL_MARKETS=research.countries.map(c=>({countryCode:c.code as InternationalCountry,name:c.name,currency:'EUR' as const,cities:c.cities.map(x=>x.cityKey)}));
export function internationalCountry(value:unknown):InternationalCountry{
 let country:ServiceCountry;try{country=serviceCountry(value);}catch{return fail('Țara lucrării este invalidă.',400);}if(country==='RO')return fail('România păstrează configurația existentă.',400);
 if(!INTERNATIONAL_MARKETS.some(x=>x.countryCode===country))return fail('Piața nu este configurată.',422);
 return country;
}
const cityKey=(value:string)=>value.trim().normalize('NFKC').toLocaleLowerCase();
export function internationalCity(country:InternationalCountry,value:unknown):string{
 if(typeof value!=='string'||!value.trim()||value.length>120)return fail('Orașul lucrării este invalid.');
 const city=INTERNATIONAL_MARKETS.find(x=>x.countryCode===country)?.cities.find(x=>cityKey(x)===cityKey(value));
 return city??fail('Orașul nu are o piață configurată.',422);
}
export type InternationalSource={providerId:string;provider:string;url:string;readAt:string;quote:string;localCoverage:boolean;conditionsConfirmed:boolean;independentProviderConfirmed:boolean};
type Fee={status:'included'|'customer_provided'|'separate'|null;feeMinor:number|null};
export type InternationalTariffDefinition={
 countryCode:InternationalCountry;city:string;spaceType:InternationalSpace;service:InternationalService;currency:'EUR';
 rateUnit:InternationalRateUnit;rateMinor:number|null;workers:number|null;minimumMinutes:number|null;supplierMinimumMinutes:number|null;minimumNetMinor:number|null;
 vatBps:number|null;materials:Fee;travel:Fee;maxSqm:number|null;durationMinutes:number|null;validFrom:string|null;validUntil:string|null;
 sources:InternationalSource[];verification:Record<'pricing'|'vat'|'minimum'|'crew'|'materials'|'travel'|'coverage',boolean>;
};
const object=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:fail('Date invalide.');
const text=(v:unknown,max:number)=>typeof v==='string'&&v.trim()&&v.length<=max?v.trim():fail('Text invalid sau prea lung.');
const nullableNumber=(v:unknown,min:number,max:number):number|null=>v==null?null:typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max?v:fail('Sumă sau durată invalidă.');
function date(value:unknown):string|null{
 if(value==null||value==='')return null;
 const s=text(value,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||Number.isNaN(Date.parse(s+'T00:00:00Z'))||new Date(s+'T00:00:00Z').toISOString().slice(0,10)!==s)return fail('Dată invalidă.');return s;
}
function fee(value:unknown,travel=false):Fee{
 if(value==null)return {status:null,feeMinor:null};const d=object(value),status=d.status==null?null:d.status;
 if(status!==null&&!['included','separate',...(travel?[]:['customer_provided'])].includes(String(status)))return fail('Regimul cheltuielilor este invalid.');
 return {status:status as Fee['status'],feeMinor:nullableNumber(d.feeMinor,0,100_000_000)};
}
function source(value:unknown):InternationalSource{
 const d=object(value),url=text(d.url,800);let parsed:URL;
 try{parsed=new URL(url);}catch{return fail('Sursa trebuie să fie un URL HTTPS public.');}
 if(parsed.protocol!=='https:'||parsed.username||parsed.password||!parsed.hostname.includes('.')||parsed.hostname==='localhost'||/^\d+(?:\.\d+){3}$/.test(parsed.hostname))return fail('Sursa trebuie să fie un URL HTTPS public.');
 const readAt=text(d.readAt,40);if(!Number.isFinite(Date.parse(readAt)))return fail('Data citirii sursei este invalidă.');
 return {providerId:text(d.providerId,100),provider:text(d.provider,160),url:parsed.href,readAt,quote:text(d.quote,3000),localCoverage:d.localCoverage===true,conditionsConfirmed:d.conditionsConfirmed===true,independentProviderConfirmed:d.independentProviderConfirmed===true};
}
/** Partial drafts are allowed; approval is separately blocked by missing evidence/conditions. */
export function parseInternationalTariff(value:unknown):InternationalTariffDefinition{
 const d=object(value),countryCode=internationalCountry(d.countryCode),city=internationalCity(countryCode,d.city);
 if(d.currency!==undefined&&d.currency!=='EUR')return fail('Tarifele internaționale se definesc în EUR.');
 if(!['apartament','casa','birou','altul'].includes(String(d.spaceType))||!['maintenance','general','renovation'].includes(String(d.service)))return fail('Spațiul sau serviciul este invalid.');
 if(!['worker_hour','team_hour','m2','visit'].includes(String(d.rateUnit)))return fail('Unitatea tarifului este invalidă.');
 if(d.sources!==undefined&&(!Array.isArray(d.sources)||d.sources.length>8))return fail('Sunt permise cel mult opt surse.');
 const v=d.verification===undefined?{}:object(d.verification),verification={} as InternationalTariffDefinition['verification'];
 for(const key of ['pricing','vat','minimum','crew','materials','travel','coverage'] as const)verification[key]=v[key]===true;
 return {countryCode,city,currency:'EUR',spaceType:d.spaceType as InternationalSpace,service:d.service as InternationalService,rateUnit:d.rateUnit as InternationalRateUnit,
  rateMinor:nullableNumber(d.rateMinor,1,100_000_000),workers:nullableNumber(d.workers,1,100),minimumMinutes:nullableNumber(d.minimumMinutes,180,1440),supplierMinimumMinutes:nullableNumber(d.supplierMinimumMinutes,0,1440),minimumNetMinor:nullableNumber(d.minimumNetMinor,0,100_000_000),
  vatBps:nullableNumber(d.vatBps,0,10000),materials:fee(d.materials),travel:fee(d.travel,true),maxSqm:nullableNumber(d.maxSqm,1,100_000),durationMinutes:nullableNumber(d.durationMinutes,180,1440),validFrom:date(d.validFrom),validUntil:date(d.validUntil),sources:(Array.isArray(d.sources)?d.sources:[]).map(source),verification};
}
export function internationalTariffBlockers(d:InternationalTariffDefinition,now=new Date()):string[]{
 const b:string[]=[];if(d.rateMinor===null)b.push('Tariful net nu este confirmat.');if(d.workers===null)b.push('Numărul lucrătorilor nu este confirmat.');
 if(d.minimumMinutes===null||d.supplierMinimumMinutes===null||d.minimumNetMinor===null)b.push('Minimele de timp și valoare nu sunt confirmate.');
 if(d.durationMinutes===null||d.maxSqm===null)b.push('Durata și suprafața acoperită nu sunt confirmate.');
 if(d.vatBps===null)b.push('TVA sau scutirea nu este confirmată.');
 for(const [label,f] of [['Produsele',d.materials],['Deplasarea',d.travel]] as const){if(f.status===null||f.feeMinor===null)b.push(label+' nu sunt clarificate.');else if(f.status!=='separate'&&f.feeMinor!==0)b.push(label+' incluse/furnizate de client trebuie să aibă supliment zero.');}
 const today=now.toISOString().slice(0,10);if(!d.validFrom||!d.validUntil)b.push('Valabilitatea tarifului nu este confirmată.');else if(d.validUntil<d.validFrom||d.validFrom>today||d.validUntil<today)b.push('Tariful nu este valabil la data curentă.');
 if(new Set(d.sources.map(s=>s.providerId.toLowerCase())).size<2||new Set(d.sources.map(s=>new URL(s.url).hostname.replace(/^www\./,''))).size<2)b.push('Sunt necesare două firme distincte cu surse proprii.');
 if(d.sources.some(s=>!s.independentProviderConfirmed))b.push('Identitatea distinctă a firmelor nu este confirmată; două domenii nu dovedesc două firme.');
 if(d.sources.some(s=>!s.localCoverage||!s.conditionsConfirmed))b.push('Sursele nu confirmă acoperirea și condițiile.');
 if(d.sources.some(s=>Date.parse(s.readAt)>now.getTime()||now.getTime()-Date.parse(s.readAt)>90*86400000))b.push('Sursele trebuie recitite în ultimele 90 de zile.');
 if(Object.values(d.verification).some(x=>!x))b.push('Validarea condițiilor și a dovezilor este incompletă.');return b;
}
export const INTERNATIONAL_TARIFF_SCHEMA=`
CREATE TABLE IF NOT EXISTS international_tariffs(
 id TEXT PRIMARY KEY,revision INTEGER NOT NULL CHECK(revision>0),status TEXT NOT NULL CHECK(status IN ('draft','evidence','approved','active')),
 definition_json TEXT NOT NULL,approval_reference TEXT,approved_by TEXT,approved_at TEXT,updated_by TEXT NOT NULL,updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS international_tariff_revisions(
 tariff_id TEXT NOT NULL REFERENCES international_tariffs(id),revision INTEGER NOT NULL,status TEXT NOT NULL,definition_json TEXT NOT NULL,actor TEXT NOT NULL,created_at TEXT NOT NULL,
 PRIMARY KEY(tariff_id,revision)
);
CREATE TRIGGER IF NOT EXISTS international_tariff_revision_immutable_update BEFORE UPDATE ON international_tariff_revisions BEGIN SELECT RAISE(ABORT,'Tariff revision is immutable');END;
CREATE TRIGGER IF NOT EXISTS international_tariff_revision_immutable_delete BEFORE DELETE ON international_tariff_revisions BEGIN SELECT RAISE(ABORT,'Tariff revision history is retained');END;
`;
export function ensureInternationalTariffSchema(db:Database.Database){db.exec(INTERNATIONAL_TARIFF_SCHEMA);}
export type InternationalTariff={id:string;revision:number;status:InternationalStatus;definition:InternationalTariffDefinition;blockers:string[];approvalReference:string|null;updatedAt:string};
type Row={id:string;revision:number;status:InternationalStatus;definition_json:string;approval_reference:string|null;updated_at:string};
const exists=(db:Database.Database)=>!!db.prepare("SELECT 1 FROM sqlite_master WHERE name='international_tariffs' AND type='table'").get();
const read=(r:Row,now=new Date()):InternationalTariff=>{const definition=parseInternationalTariff(JSON.parse(r.definition_json));return {id:r.id,revision:r.revision,status:r.status,definition,blockers:internationalTariffBlockers(definition,now),approvalReference:r.approval_reference,updatedAt:r.updated_at};};
export function listInternationalTariffs(db:Database.Database,now=new Date()):InternationalTariff[]{return exists(db)?(db.prepare('SELECT * FROM international_tariffs ORDER BY updated_at DESC,id LIMIT 1000').all() as Row[]).map(x=>read(x,now)):[];}
export function internationalTariffOverview(db:Database.Database){
 const tariffs=listInternationalTariffs(db);return {reviewEnabled:internationalReviewEnabled(),activationEnabled:false,markets:INTERNATIONAL_MARKETS.map(m=>({...m,cities:m.cities.map(city=>{const rows=tariffs.filter(x=>x.definition.countryCode===m.countryCode&&x.definition.city===city);return {city,status:rows.find(x=>x.status==='active')?.status??rows.find(x=>x.status==='approved')?.status??rows.find(x=>x.status==='evidence')?.status??'draft',tariffs:rows,blockers:rows.length?Array.from(new Set(rows.flatMap(x=>x.blockers))):['Niciun tarif aprobat. Cercetarea nu activează rezervări.']};})})),tariffs,totals:{countries:INTERNATIONAL_MARKETS.length,cities:INTERNATIONAL_MARKETS.reduce((n,x)=>n+x.cities.length,0),approved:tariffs.filter(x=>x.status==='approved').length,active:tariffs.filter(x=>x.status==='active').length}};
}
/** Explicit schema migration must precede writes; GET never creates tables. Edits revoke approval. */
export function saveInternationalTariffDraft(db:Database.Database,id:unknown,revision:unknown,value:unknown,actor:string,now=new Date()):InternationalTariff{
 if(!exists(db))return fail('Registrul nu este inițializat.',503);const definition=parseInternationalTariff(value),json=JSON.stringify(definition),at=now.toISOString();
 if(typeof actor!=='string'||!actor)return fail('Identitate administrativă invalidă.',403);
 if(id!==undefined&&(typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(id)))return fail('Identificator invalid.');
 if(!Number.isSafeInteger(revision)||Number(revision)<0)return fail('Revizie invalidă.');
 return db.transaction(()=>{
  const current=id?db.prepare('SELECT * FROM international_tariffs WHERE id=?').get(id) as Row|undefined:undefined;
  if(current&&current.definition_json===json&&current.revision===revision)return read(current,now);
  if(current?.revision!==revision&&!(current===undefined&&revision===0))return fail('Tariful a fost modificat. Reîncarcă registrul.',409);
  if(id&&!current)return fail('Tariful nu mai este disponibil.',404);
  const target=current?.id??randomUUID(),next=(current?.revision??0)+1,status:InternationalStatus=definition.sources.length?'evidence':'draft';
  if(current)db.prepare('UPDATE international_tariffs SET revision=?,status=?,definition_json=?,approval_reference=NULL,approved_by=NULL,approved_at=NULL,updated_by=?,updated_at=? WHERE id=? AND revision=?').run(next,status,json,actor,at,target,current.revision);
  else db.prepare('INSERT INTO international_tariffs(id,revision,status,definition_json,updated_by,updated_at) VALUES(?,?,?,?,?,?)').run(target,next,status,json,actor,at);
  db.prepare('INSERT INTO international_tariff_revisions VALUES(?,?,?,?,?,?)').run(target,next,status,json,actor,at);
  return read(db.prepare('SELECT * FROM international_tariffs WHERE id=?').get(target) as Row,now);
 }).immediate();
}
/** No HTTP action exposes this transition in the review release. */
export function transitionInternationalTariff(db:Database.Database,id:string,revision:number,status:'approved'|'active',actor:string,approvalReference:string,now=new Date()):InternationalTariff{
 if(!internationalReviewEnabled())return fail('Activarea este disponibilă numai în mediul izolat de revizie.',403);
 if(!actor||typeof approvalReference!=='string'||!approvalReference.trim()||approvalReference.length>300)return fail('Aprobarea explicită trebuie identificată.');
 return db.transaction(()=>{
  const row=exists(db)?db.prepare('SELECT * FROM international_tariffs WHERE id=?').get(id) as Row|undefined:undefined;if(!row)return fail('Tarif indisponibil.',404);
  if(row.revision!==revision)return fail('Revizie expirată.',409);const current=read(row,now);if(current.blockers.length)return fail('Condițiile tarifului nu sunt complet validate.',422);
  if(status==='active'&&row.status!=='approved')return fail('Tariful trebuie aprobat înainte de activare.',409);
  const next=row.revision+1,at=now.toISOString();
  db.prepare('UPDATE international_tariffs SET revision=?,status=?,approval_reference=?,approved_by=?,approved_at=?,updated_by=?,updated_at=? WHERE id=? AND revision=?').run(next,status,approvalReference,actor,at,actor,at,id,revision);
  db.prepare('INSERT INTO international_tariff_revisions VALUES(?,?,?,?,?,?)').run(id,next,status,row.definition_json,actor,at);return read(db.prepare('SELECT * FROM international_tariffs WHERE id=?').get(id) as Row,now);
 }).immediate();
}
