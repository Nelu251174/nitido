import {describe,it,expect,beforeEach,afterEach} from 'vitest';
import Database from 'better-sqlite3';
import {calcServicePrice} from './pricing';
import {initialPriceDefinition,calculateManagedPrice,validatePriceDefinition,validatePriceScope,PRICING_SPACES,ManagedPricingError,type PriceScope} from './managedPricing';
import {MANAGED_PRICING_SCHEMA,createTariff,saveTariff,simulateTariff,publishTariff,withdrawTariff,resolveManagedPrice,listTariffs} from './managedPricingStore';

const now=new Date('2026-09-25T09:00:00Z'),start='2026-09-25T10:00:00Z',active=new Date('2026-09-25T10:30:00Z');
const input={spaceType:'apartament' as const,sqm:120,windowsSqm:10};
let db:Database.Database;
beforeEach(()=>{db=new Database(':memory:');db.pragma('foreign_keys = ON');db.exec(MANAGED_PRICING_SCHEMA);});
afterEach(()=>db.close());
function published(scope:PriceScope={kind:'national'},until:string|null=null){
  const created=createTariff(db,'Test',undefined,now);
  const saved=saveTariff(db,created.id,0,created.definition,scope,created.label,now);
  const sim=simulateTariff(db,saved.id,saved.revision,now);
  return publishTariff(db,saved.id,saved.revision,sim.simulationId,start,until,now);
}
function status(id:string){return listTariffs(db).find(t=>t.id===id)!;}

describe('managed pricing calculation',()=>{
  it('matches every supported square metre and window boundaries of the approved tariff',()=>{
    const definition=validatePriceDefinition(initialPriceDefinition());
    for(const spaceType of PRICING_SPACES)for(let sqm=1;sqm<=1000;sqm++)for(const windowsSqm of [0,1,200]){
      expect(calculateManagedPrice(definition,{spaceType,sqm,windowsSqm}).totalBani).toBe(Math.round(calcServicePrice(spaceType,sqm,windowsSqm)*100));
    }
  });
  it('uses exactly one primary method and applies windows separately',()=>{
    const d=initialPriceDefinition();d.rules.birou={method:'hour',rateBani:12345,minimumBani:30000};
    const result=calculateManagedPrice(d,{spaceType:'birou',sqm:900,hours:2,windowsSqm:10});
    expect(result).toMatchObject({cleaningBani:30000,windowsBani:8000,totalBani:38000});
    expect(result.lines.reduce((sum,l)=>sum+l.amountBani,0)).toBe(result.totalBani);
    expect(()=>calculateManagedPrice(d,{spaceType:'birou',sqm:100})).toThrow();
  });
  it('never returns a guessed price for a manual rule',()=>{
    const d=initialPriceDefinition();d.rules.casa={method:'manual'};
    expect(()=>calculateManagedPrice(d,{spaceType:'casa',sqm:100})).toThrow(/manuală/);
  });
  it.each([{sqm:0},{sqm:1.5},{sqm:1001},{sqm:Infinity},{sqm:'100'},{windowsSqm:-1},{windowsSqm:201},{spaceType:'other'}])('rejects invalid quote input %j',patch=>{
    expect(()=>calculateManagedPrice(initialPriceDefinition(),{...input,...patch} as never)).toThrow();
  });
  it('rejects invalid currency, rounding, missing rules and overlapping package thresholds',()=>{
    for(const patch of [{currency:'EUR'},{roundingBani:1},{rules:{}},{windowsRateBani:-1}])expect(()=>validatePriceDefinition({...initialPriceDefinition(),...patch})).toThrow();
    const d=initialPriceDefinition();d.rules.apartament={method:'package',tiers:[{maxSqm:40,amountBani:100},{maxSqm:40,amountBani:200}],overflowRateBani:1};
    expect(()=>validatePriceDefinition(d)).toThrow(/Pragurile/);
  });
});

describe('tariff lifecycle',()=>{
  it('requires simulation of the exact saved revision and prevents stale edits',()=>{
    const t=createTariff(db,'Test',undefined,now);
    expect(()=>publishTariff(db,t.id,0,'unknown',start,null,now)).toThrow(/Simulează/);
    const sim=simulateTariff(db,t.id,0,now);
    expect(sim.results.every(r=>r.deltaBani===0)).toBe(true);
    saveTariff(db,t.id,0,t.definition,t.scope,'Nou',now);
    expect(()=>saveTariff(db,t.id,0,t.definition,t.scope,'Vechi',now)).toThrow(/schimbat/);
    expect(()=>publishTariff(db,t.id,1,sim.simulationId,start,null,now)).toThrow(/Simulează/);
  });
  it('rejects same-priority overlapping publication with canonical city names',()=>{
    published({kind:'city',city:'Constanța'});
    const t=createTariff(db,'Overlap',undefined,now),s=saveTariff(db,t.id,0,t.definition,{kind:'city',city:' CONSTANTA '},t.label,now),sim=simulateTariff(db,s.id,s.revision,now);
    expect(()=>publishTariff(db,s.id,s.revision,sim.simulationId,start,null,now)).toThrow(/suprapuneri/);
    expect(status(t.id).status).toBe('draft');
  });
  it('allows adjacent half-open periods and rejects backdated or offset-free dates',()=>{
    published({kind:'national'},'2026-09-25T11:00:00Z');
    const t=createTariff(db,'Next',undefined,now),sim=simulateTariff(db,t.id,0,now);
    for(const date of ['2026-09-24T09:00:00Z','2026-09-25T11:00:00','2026-02-30T11:00:00Z'])expect(()=>publishTariff(db,t.id,0,sim.simulationId,date,null,now)).toThrow();
    publishTariff(db,t.id,0,sim.simulationId,'2026-09-25T14:00:00+03:00',null,now);
    expect(resolveManagedPrice(db,{},input,new Date('2026-09-25T11:00:00Z')).tariffId).toBe(t.id);
  });
  it('resolves contract > zone > city > national and blocks missing configuration',()=>{
    expect(()=>resolveManagedPrice(db,{},input,active)).toThrow(/Nu există/);
    const n=published(),c=published({kind:'city',city:'București'}),z=published({kind:'zone',city:'București',zone:'Nord'}),p=published({kind:'contract',contractId:'pro-1'});
    expect(resolveManagedPrice(db,{city:'Cluj'},input,active).tariffId).toBe(n.id);
    expect(resolveManagedPrice(db,{city:'Bucuresti'},input,active).tariffId).toBe(c.id);
    expect(resolveManagedPrice(db,{city:'BUCUREȘTI',zone:'nord'},input,active).tariffId).toBe(z.id);
    expect(resolveManagedPrice(db,{city:'Bucuresti',zone:'Nord',contractId:'pro-1'},input,active).tariffId).toBe(p.id);
    expect(()=>resolveManagedPrice(db,{},input,now)).toThrow(/Nu există/);
  });
  it('fails closed if stored configurations are ambiguous',()=>{
    published();const t=createTariff(db,'Corrupted import',undefined,now);
    db.prepare("UPDATE managed_tariffs SET status='published',valid_from=? WHERE id=?").run(start,t.id);
    expect(()=>resolveManagedPrice(db,{},input,active)).toThrow(/ambigue/);
  });
  it('retains history on withdrawal and never rewrites existing job snapshots',()=>{
    db.exec("CREATE TABLE jobs(id TEXT,pricing_snapshot TEXT);INSERT INTO jobs VALUES('old','original-price');");
    const t=published(),quote=resolveManagedPrice(db,{},input,active),before=JSON.stringify(quote);
    withdrawTariff(db,t.id,t.revision,'Corecție viitoare',active);
    expect(status(t.id).status).toBe('withdrawn');
    expect(()=>resolveManagedPrice(db,{},input,active)).toThrow(/Nu există/);
    expect(JSON.stringify(quote)).toBe(before);
    expect(db.prepare('SELECT pricing_snapshot FROM jobs').get()).toEqual({pricing_snapshot:'original-price'});
    expect(()=>db.prepare('DELETE FROM managed_tariffs WHERE id=?').run(t.id)).toThrow(/retained/);
    expect(()=>db.prepare("UPDATE managed_tariffs SET status='draft' WHERE id=?").run(t.id)).toThrow();
    expect(()=>db.prepare('UPDATE managed_tariffs SET definition_json=? WHERE id=?').run('{}',t.id)).toThrow(/immutable/);
    expect(()=>db.exec('DELETE FROM managed_tariff_audit')).toThrow(/append-only/);
  });
  it('rolls back publication if its audit cannot be persisted',()=>{
    const t=createTariff(db,'Test',undefined,now),sim=simulateTariff(db,t.id,0,now);
    db.exec("CREATE TRIGGER fail_audit BEFORE INSERT ON managed_tariff_audit WHEN NEW.action='published' BEGIN SELECT RAISE(ABORT,'audit unavailable'); END;");
    expect(()=>publishTariff(db,t.id,0,sim.simulationId,start,null,now)).toThrow(/audit unavailable/);
    expect(status(t.id)).toMatchObject({status:'draft',revision:0,valid_from:null,published_at:null});
  });
  it('creates a new editable copy without mutating its published source',()=>{
    const source=published();const copy=createTariff(db,'Copy',source.id,active);
    expect(copy).toMatchObject({status:'draft',revision:0,definition:source.definition,valid_from:null});
    expect(copy.id).not.toBe(source.id);expect(status(source.id)).toEqual(source);
  });
  it('validates scope and rejects unsafe prices before publication',()=>{
    expect(()=>validatePriceScope({kind:'city',city:''})).toThrow();
    const d=initialPriceDefinition();d.rules.casa={method:'sqm',rateBani:100_000_000,minimumBani:0};
    expect(()=>calculateManagedPrice(validatePriceDefinition(d),{spaceType:'casa',sqm:1000})).toThrow(ManagedPricingError);
  });
});
