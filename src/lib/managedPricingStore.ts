import type {Database} from 'better-sqlite3';
import {randomUUID,createHash} from 'node:crypto';
import {calcServicePrice} from './pricing';
import {calculateManagedPrice,initialPriceDefinition,validatePriceDefinition,validatePriceScope,priceScopeKey,scopeMatches,scopePriority,PRICING_SPACES,ManagedPricingError,type PriceDefinition,type PriceScope,type PriceContext,type PriceInput} from './managedPricing';

export const MANAGED_PRICING_SCHEMA=`
CREATE TABLE IF NOT EXISTS managed_tariffs(
 id TEXT PRIMARY KEY,label TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 0,
 status TEXT NOT NULL CHECK(status IN ('draft','published','withdrawn')),
 scope_json TEXT NOT NULL,scope_key TEXT NOT NULL,definition_json TEXT NOT NULL,
 valid_from TEXT,valid_until TEXT,created_at TEXT NOT NULL,published_at TEXT,withdrawn_at TEXT
);
CREATE TABLE IF NOT EXISTS managed_tariff_simulations(
 id TEXT PRIMARY KEY,tariff_id TEXT NOT NULL REFERENCES managed_tariffs(id),revision INTEGER NOT NULL,
 digest TEXT NOT NULL,result_json TEXT NOT NULL,created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS managed_tariff_audit(
 id TEXT PRIMARY KEY,tariff_id TEXT NOT NULL REFERENCES managed_tariffs(id),action TEXT NOT NULL,
 revision INTEGER NOT NULL,details_json TEXT NOT NULL,created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS managed_tariff_scope ON managed_tariffs(status,scope_key,valid_from);
CREATE TRIGGER IF NOT EXISTS managed_tariff_immutable BEFORE UPDATE ON managed_tariffs
 WHEN OLD.status!='draft' AND (NEW.definition_json IS NOT OLD.definition_json OR NEW.scope_json IS NOT OLD.scope_json
 OR NEW.scope_key IS NOT OLD.scope_key OR NEW.valid_from IS NOT OLD.valid_from OR NEW.valid_until IS NOT OLD.valid_until
 OR NEW.label IS NOT OLD.label OR NEW.published_at IS NOT OLD.published_at OR NEW.created_at IS NOT OLD.created_at OR NEW.id IS NOT OLD.id)
 BEGIN SELECT RAISE(ABORT,'Published tariff is immutable'); END;
CREATE TRIGGER IF NOT EXISTS managed_tariff_state BEFORE UPDATE OF status ON managed_tariffs
 WHEN NOT (NEW.status=OLD.status OR (OLD.status='draft' AND NEW.status='published') OR (OLD.status='published' AND NEW.status='withdrawn'))
 BEGIN SELECT RAISE(ABORT,'Invalid tariff transition'); END;
CREATE TRIGGER IF NOT EXISTS managed_tariff_no_delete BEFORE DELETE ON managed_tariffs BEGIN SELECT RAISE(ABORT,'Tariff history is retained'); END;
CREATE TRIGGER IF NOT EXISTS managed_tariff_audit_no_update BEFORE UPDATE ON managed_tariff_audit BEGIN SELECT RAISE(ABORT,'Audit is append-only'); END;
CREATE TRIGGER IF NOT EXISTS managed_tariff_audit_no_delete BEFORE DELETE ON managed_tariff_audit BEGIN SELECT RAISE(ABORT,'Audit is append-only'); END;
CREATE TRIGGER IF NOT EXISTS managed_tariff_simulation_no_update BEFORE UPDATE ON managed_tariff_simulations BEGIN SELECT RAISE(ABORT,'Simulation is immutable'); END;
CREATE TRIGGER IF NOT EXISTS managed_tariff_simulation_no_delete BEFORE DELETE ON managed_tariff_simulations BEGIN SELECT RAISE(ABORT,'Simulation is retained'); END;
`;
export interface TariffRow {id:string;label:string;revision:number;status:'draft'|'published'|'withdrawn';scope_json:string;scope_key:string;definition_json:string;valid_from:string|null;valid_until:string|null;created_at:string;published_at:string|null;withdrawn_at:string|null}
export type Tariff = Omit<TariffRow,'scope_json'|'definition_json'|'scope_key'> & {scope:PriceScope;definition:PriceDefinition};
export type SimulationRow = {spaceType:string;sqm:number;windowsSqm:number;hours?:number;legacyBani:number;proposedBani:number|null;deltaBani:number|null;note?:string};
const decode=(r:TariffRow):Tariff=>{const {scope_json,definition_json,scope_key,...rest}=r;void scope_key;return {...rest,scope:JSON.parse(scope_json),definition:JSON.parse(definition_json)};};
function row(db:Database,id:unknown):TariffRow {if(typeof id!=='string')throw new ManagedPricingError('Versiune invalidă.');const r=db.prepare('SELECT * FROM managed_tariffs WHERE id=?').get(id) as TariffRow|undefined;if(!r)throw new ManagedPricingError('Versiunea nu există.',404);return r;}
function expected(r:TariffRow,revision:unknown,status:TariffRow['status']){if(!Number.isSafeInteger(revision)||revision!==r.revision||r.status!==status)throw new ManagedPricingError('Versiunea sau starea s-a schimbat. Reîncarcă lista.',409);}
function labelText(label:unknown){if(typeof label!=='string'||!label.trim()||label.trim().length>120)throw new ManagedPricingError('Denumirea trebuie să aibă între 1 și 120 de caractere.');return label.trim();}
function audit(db:Database,id:string,action:string,revision:number,details:object,now:Date){db.prepare('INSERT INTO managed_tariff_audit VALUES(?,?,?,?,?,?)').run(randomUUID(),id,action,revision,JSON.stringify(details),now.toISOString());}
const digest=(r:TariffRow)=>createHash('sha256').update(JSON.stringify([r.id,r.revision,r.scope_json,r.definition_json])).digest('hex');
export function listTariffs(db:Database):Tariff[]{return (db.prepare('SELECT * FROM managed_tariffs ORDER BY created_at DESC,id DESC').all() as TariffRow[]).map(decode);}
export function createTariff(db:Database,label:unknown,sourceId?:unknown,now=new Date()):Tariff {
  return db.transaction(()=>{
    const name=labelText(label),source=sourceId?decode(row(db,sourceId)):null,id=randomUUID();
    const scope=source?.scope??{kind:'national'};
    db.prepare(`INSERT INTO managed_tariffs(id,label,revision,status,scope_json,scope_key,definition_json,created_at) VALUES(?,?,0,'draft',?,?,?,?)`).run(id,name,JSON.stringify(scope),priceScopeKey(scope),JSON.stringify(source?.definition??initialPriceDefinition()),now.toISOString());
    audit(db,id,'created',0,{sourceId:source?.id??null},now);return decode(row(db,id));
  }).immediate();
}
export function saveTariff(db:Database,id:unknown,revision:unknown,definition:unknown,scope:unknown,label:unknown,now=new Date()):Tariff {
  const d=validatePriceDefinition(definition),s=validatePriceScope(scope),name=labelText(label);
  return db.transaction(()=>{const r=row(db,id);expected(r,revision,'draft');
    db.prepare('UPDATE managed_tariffs SET label=?,definition_json=?,scope_json=?,scope_key=?,revision=revision+1 WHERE id=?').run(name,JSON.stringify(d),JSON.stringify(s),priceScopeKey(s),r.id);
    audit(db,r.id,'saved',r.revision+1,{},now);return decode(row(db,r.id));
  }).immediate();
}
export function simulateTariff(db:Database,id:unknown,revision:unknown,now=new Date()){
  return db.transaction(()=>{
    const r=row(db,id);expected(r,revision,'draft');const d=validatePriceDefinition(JSON.parse(r.definition_json));
    const results:SimulationRow[]=[];
    for(const spaceType of PRICING_SPACES){
      const rule=d.rules[spaceType],areas=new Set([1,10,40,41,60,61,80,81,100,101,120,1000]);
      if(rule.method==='package')for(const t of rule.tiers){areas.add(t.maxSqm);if(t.maxSqm<1000)areas.add(t.maxSqm+1);}
      for(const sqm of [...areas].sort((a,b)=>a-b))for(const windowsSqm of [0,10,200]){
        const input={spaceType,sqm,windowsSqm,...(rule.method==='hour'?{hours:2}:{})};
        const legacyBani=Math.round(calcServicePrice(spaceType,sqm,windowsSqm)*100);
        if(rule.method==='manual'){results.push({...input,legacyBani,proposedBani:null,deltaBani:null,note:'Ofertă manuală necesară'});continue;}
        const proposedBani=calculateManagedPrice(d,input).totalBani;
        results.push({...input,legacyBani,proposedBani,deltaBani:proposedBani-legacyBani});
      }
    }
    const simulationId=randomUUID();
    db.prepare('INSERT INTO managed_tariff_simulations VALUES(?,?,?,?,?,?)').run(simulationId,r.id,r.revision,digest(r),JSON.stringify(results),now.toISOString());
    audit(db,r.id,'simulated',r.revision,{simulationId,cases:results.length},now);
    return {simulationId,revision:r.revision,results};
  }).immediate();
}
function instant(value:unknown):string {
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)||!Number.isFinite(Date.parse(value)))throw new ManagedPricingError('Data trebuie să includă ora și fusul orar.');
  const day=value.slice(0,10);if(new Date(`${day}T12:00:00Z`).toISOString().slice(0,10)!==day)throw new ManagedPricingError('Dată calendaristică invalidă.');
  return new Date(value).toISOString();
}
export function publishTariff(db:Database,id:unknown,revision:unknown,simulationId:unknown,from:unknown,until:unknown,now=new Date()):Tariff {
  const start=instant(from),end=until===null?null:instant(until);
  if(start<now.toISOString()||(end!==null&&end<=start))throw new ManagedPricingError('Publicarea trebuie programată în viitor, cu sfârșitul după început.');
  return db.transaction(()=>{
    const r=row(db,id);expected(r,revision,'draft');validatePriceDefinition(JSON.parse(r.definition_json));
    if(typeof simulationId!=='string'||!db.prepare('SELECT 1 FROM managed_tariff_simulations WHERE id=? AND tariff_id=? AND revision=? AND digest=?').get(simulationId,r.id,r.revision,digest(r)))throw new ManagedPricingError('Simulează și verifică versiunea salvată înainte de publicare.',409);
    const overlaps=db.prepare(`SELECT id FROM managed_tariffs WHERE status='published' AND scope_key=? AND (valid_until IS NULL OR valid_until>?) AND (? IS NULL OR valid_from<?)`).get(r.scope_key,start,end,end);
    if(overlaps)throw new ManagedPricingError('Există deja o versiune publicată pentru această arie și perioadă. Retrage versiunea sau alege o perioadă fără suprapuneri.',409);
    db.prepare("UPDATE managed_tariffs SET status='published',revision=revision+1,valid_from=?,valid_until=?,published_at=? WHERE id=?").run(start,end,now.toISOString(),r.id);
    audit(db,r.id,'published',r.revision+1,{simulationId,from:start,until:end},now);return decode(row(db,r.id));
  }).immediate();
}
export function withdrawTariff(db:Database,id:unknown,revision:unknown,reason:unknown,now=new Date()):Tariff {
  const note=labelText(reason);
  return db.transaction(()=>{const r=row(db,id);expected(r,revision,'published');db.prepare("UPDATE managed_tariffs SET status='withdrawn',revision=revision+1,withdrawn_at=? WHERE id=?").run(now.toISOString(),r.id);audit(db,r.id,'withdrawn',r.revision+1,{reason:note},now);return decode(row(db,r.id));}).immediate();
}
/** Server-side resolver. Booking activation is intentionally separate from administrative publication. */
export function resolveManagedPrice(db:Database,context:PriceContext,input:PriceInput,now=new Date()){
  const candidates=(db.prepare("SELECT * FROM managed_tariffs WHERE status='published' AND valid_from<=? AND (valid_until IS NULL OR valid_until>?)").all(now.toISOString(),now.toISOString()) as TariffRow[])
    .map(decode).filter(t=>scopeMatches(t.scope,context)).sort((a,b)=>scopePriority(b.scope)-scopePriority(a.scope));
  if(!candidates.length)throw new ManagedPricingError('Nu există tarif publicat pentru acest context și moment.',422);
  if(candidates.length>1&&scopePriority(candidates[0].scope)===scopePriority(candidates[1].scope))throw new ManagedPricingError('Tarife ambigue. Confirmarea este blocată.',409);
  const t=candidates[0];
  return {tariffId:t.id,revision:t.revision,recordedAt:now.toISOString(),context:{...context},input:{...input},...calculateManagedPrice(t.definition,input)};
}
