import type {Database} from 'better-sqlite3';
import {randomUUID} from 'node:crypto';
import {MarginError,validateManualEstimate,calculateOperationalMargin} from './operationalMargin';
export function manualOffersEnabled(){return process.env.NITIDO_MANUAL_OFFERS_SANDBOX==='true'&&process.env.NEXT_PUBLIC_SITE_URL==='https://sandbox.nitido.ro'&&!process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_');}
export const MANUAL_OFFERS_SCHEMA=`
CREATE TABLE IF NOT EXISTS assessment_offers(
 id TEXT PRIMARY KEY,assessment_id TEXT NOT NULL REFERENCES service_assessments(id),estimate_revision INTEGER NOT NULL,
 assessment_version INTEGER NOT NULL,public_json TEXT NOT NULL,expires_at TEXT NOT NULL,created_at TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('offered','accepted','rejected','withdrawn','superseded')),
 UNIQUE(assessment_id,estimate_revision),FOREIGN KEY(assessment_id,estimate_revision) REFERENCES assessment_estimates(assessment_id,revision)
);
CREATE UNIQUE INDEX IF NOT EXISTS assessment_offer_current ON assessment_offers(assessment_id) WHERE status IN ('offered','accepted');
CREATE TABLE IF NOT EXISTS assessment_offer_events(id INTEGER PRIMARY KEY AUTOINCREMENT,offer_id TEXT NOT NULL REFERENCES assessment_offers(id),actor_id TEXT NOT NULL,action TEXT NOT NULL,reason TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TRIGGER IF NOT EXISTS assessment_offer_frozen BEFORE UPDATE ON assessment_offers
 WHEN NEW.id IS NOT OLD.id OR NEW.assessment_id IS NOT OLD.assessment_id OR NEW.estimate_revision IS NOT OLD.estimate_revision OR NEW.assessment_version IS NOT OLD.assessment_version OR NEW.public_json IS NOT OLD.public_json OR NEW.expires_at IS NOT OLD.expires_at OR NEW.created_at IS NOT OLD.created_at OR OLD.status!='offered' OR NEW.status NOT IN ('accepted','rejected','withdrawn','superseded')
 BEGIN SELECT RAISE(ABORT,'Offer is immutable'); END;
CREATE TRIGGER IF NOT EXISTS assessment_offer_no_delete BEFORE DELETE ON assessment_offers BEGIN SELECT RAISE(ABORT,'Offer history retained'); END;
CREATE TRIGGER IF NOT EXISTS assessment_offer_event_no_update BEFORE UPDATE ON assessment_offer_events BEGIN SELECT RAISE(ABORT,'Offer audit immutable'); END;
CREATE TRIGGER IF NOT EXISTS assessment_offer_event_no_delete BEFORE DELETE ON assessment_offer_events BEGIN SELECT RAISE(ABORT,'Offer audit retained'); END;
`;
type OfferRow={id:string;assessment_id:string;estimate_revision:number;assessment_version:number;public_json:string;expires_at:string;created_at:string;status:string};
export type PublicManualOffer={id:string;assessmentId:string;revision:number;status:string;expiresAt:string;createdAt:string;terms:{currency:'RON';scope:string;context:{category:string;city:string;sqm:number};lines:{label:string;amountBani:number}[];grossBani:number;discountBani:number;totalBani:number}};
const view=(r:OfferRow,now:Date):PublicManualOffer=>({id:r.id,assessmentId:r.assessment_id,revision:r.estimate_revision,status:r.status==='offered'&&r.expires_at<=now.toISOString()?'expired':r.status,expiresAt:r.expires_at,createdAt:r.created_at,terms:JSON.parse(r.public_json)});
function text(value:unknown,max:number){if(typeof value!=='string'||!value.trim()||value.length>max)throw new MarginError(`Text obligatoriu, maximum ${max} caractere.`);return value.trim();}
function event(db:Database,id:string,actor:string,action:string,reason:string,now:Date){db.prepare('INSERT INTO assessment_offer_events(offer_id,actor_id,action,reason,created_at) VALUES(?,?,?,?,?)').run(id,actor,action,reason,now.toISOString());}
export function listManualOffers(db:Database,assessmentId:string,clientId:string|null,now=new Date()):PublicManualOffer[]{
 return (db.prepare(`SELECT o.* FROM assessment_offers o JOIN service_assessments a ON a.id=o.assessment_id WHERE a.id=? ${clientId===null?'':'AND a.client_id=?'} ORDER BY o.created_at DESC,o.id LIMIT 100`).all(assessmentId,...(clientId===null?[]:[clientId])) as OfferRow[]).map(r=>view(r,now));
}
export function publishManualOffer(db:Database,args:{id:unknown;revision:unknown;scope:unknown;expiresAt:unknown;reason:unknown},actor:string,now=new Date()){
 const assessmentId=text(args.id,100),scope=text(args.scope,4000),reason=text(args.reason,2000);
 if(!actor||!Number.isSafeInteger(args.revision)||Number(args.revision)<1)throw new MarginError('Revizie sau operator invalid.');
 if(typeof args.expiresAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/.test(args.expiresAt)||!Number.isFinite(Date.parse(args.expiresAt))||Date.parse(args.expiresAt)<=now.getTime())throw new MarginError('Expirarea trebuie să fie în viitor și să includă fusul orar.');
 const calendar=args.expiresAt.slice(0,10);
 if(new Date(calendar).toISOString().slice(0,10)!==calendar)throw new MarginError('Expirarea conține o dată calendaristică invalidă.');
 const expires=new Date(args.expiresAt).toISOString();
 return db.transaction(()=>{
 const a=db.prepare('SELECT version,status,payload FROM service_assessments WHERE id=?').get(assessmentId) as {version:number;status:string;payload:string}|undefined;
 if(!a)throw new MarginError('Cerere inexistentă.',404);
 if(['cancelled','declined'].includes(a.status))throw new MarginError('Cererea este închisă.',409);
 if(JSON.parse(a.payload).category==='renovation')throw new MarginError('Ofertele după renovare necesită fotografii verificate; acest flux nu este încă activ.',422);
 const estimate=db.prepare('SELECT * FROM assessment_estimates WHERE assessment_id=? ORDER BY revision DESC LIMIT 1').get(assessmentId) as {revision:number;assessment_version:number;definition_json:string}|undefined;
 if(!estimate||estimate.revision!==args.revision||estimate.assessment_version!==a.version)throw new MarginError('Calculul sau cererea s-a modificat. Salvează o revizie actualizată.',409);
 const definition=validateManualEstimate(JSON.parse(estimate.definition_json)),margin=calculateOperationalMargin(definition);
 if(margin.status==='incomplete')throw new MarginError('Completează sursele și costurile înainte de publicarea ofertei.',409);
 const request=JSON.parse(a.payload);
 const publicJson=JSON.stringify({currency:'RON',scope,context:{category:request.category,city:request.city,sqm:request.sqm},lines:definition.lines,grossBani:margin.grossBani,discountBani:margin.platformDiscountBani,totalBani:margin.clientDueBani});
 const old=db.prepare('SELECT * FROM assessment_offers WHERE assessment_id=? AND estimate_revision=?').get(assessmentId,args.revision) as OfferRow|undefined;
 if(old){if(old.public_json!==publicJson||old.expires_at!==expires)throw new MarginError('Această revizie a fost deja publicată cu alți termeni.',409);return view(old,now);}
 const current=db.prepare("SELECT * FROM assessment_offers WHERE assessment_id=? AND status IN ('offered','accepted')").get(assessmentId) as OfferRow|undefined;
 if(current?.status==='accepted')throw new MarginError('Oferta acceptată nu poate fi înlocuită.',409);
 if(current){db.prepare("UPDATE assessment_offers SET status='superseded' WHERE id=?").run(current.id);event(db,current.id,actor,'superseded',reason,now);}
 const id=randomUUID();db.prepare("INSERT INTO assessment_offers VALUES(?,?,?,?,?,?,?,'offered')").run(id,assessmentId,estimate.revision,a.version,publicJson,expires,now.toISOString());event(db,id,actor,'published',reason,now);
 return view(db.prepare('SELECT * FROM assessment_offers WHERE id=?').get(id) as OfferRow,now);
 }).immediate();
}
export function withdrawManualOffer(db:Database,id:unknown,actor:string,reason:unknown,now=new Date()){
 const key=text(id,100),note=text(reason,2000);text(actor,200);
 return db.transaction(()=>{const r=db.prepare('SELECT * FROM assessment_offers WHERE id=?').get(key) as OfferRow|undefined;if(!r)throw new MarginError('Oferta nu există.',404);if(r.status==='withdrawn')return view(r,now);if(r.status!=='offered')throw new MarginError('Oferta nu mai poate fi retrasă.',409);db.prepare("UPDATE assessment_offers SET status='withdrawn' WHERE id=?").run(key);event(db,key,actor,'withdrawn',note,now);return view({...r,status:'withdrawn'},now);}).immediate();
}
export function decideManualOffer(db:Database,clientId:string,args:{id:unknown;action:unknown;confirmed?:unknown;totalBani?:unknown},now=new Date()){
 const key=text(args.id,100);if(!['accept','reject'].includes(String(args.action)))throw new MarginError('Acțiune invalidă.');
 return db.transaction(()=>{
 const r=db.prepare('SELECT o.* FROM assessment_offers o JOIN service_assessments a ON a.id=o.assessment_id WHERE o.id=? AND a.client_id=?').get(key,clientId) as OfferRow|undefined;if(!r)throw new MarginError('Oferta nu este disponibilă.',404);
 const result=args.action==='accept'?'accepted':'rejected';
 if(result==='accepted'&&(args.confirmed!==true||args.totalBani!==JSON.parse(r.public_json).totalBani))throw new MarginError('Confirmă explicit totalul ofertei afișate.',409);
 if(r.status===result)return view(r,now);
 if(r.status!=='offered'||r.expires_at<=now.toISOString())throw new MarginError('Oferta a expirat sau nu mai este disponibilă. Solicită o ofertă nouă.',409);
 const a=db.prepare('SELECT version,status FROM service_assessments WHERE id=?').get(r.assessment_id) as {version:number;status:string};if(a.version!==r.assessment_version||['cancelled','declined'].includes(a.status))throw new MarginError('Cererea s-a schimbat. Este necesară o ofertă actualizată.',409);
 db.prepare('UPDATE assessment_offers SET status=? WHERE id=?').run(result,key);event(db,key,clientId,result,'Decizie explicită în contul clientului',now);return view({...r,status:result},now);
 }).immediate();
}
