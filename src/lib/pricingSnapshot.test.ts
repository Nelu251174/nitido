import {describe,it,expect} from 'vitest';
import {pricingSnapshot,PRICING_SNAPSHOT_LOCK_SQL} from './pricingSnapshot';
import Database from 'better-sqlite3';
describe('published pricing record',()=>{
 const base={spaceType:'apartament' as const,sqm:120,expressFeeLei:0,creditLei:20,createdAt:'2026-09-12T00:00:00Z'};
 it('preserves the existing 120 sqm tariff and separates platform credit',()=>{const s=pricingSnapshot(base);expect(s.grossBani).toBe(78000);expect(s.clientTotalBani).toBe(76000);expect(s.lines.reduce((n,l)=>n+l.amountBani,0)).toBe(s.clientTotalBani);expect(s.currency).toBe('RON')});
 it('retains existing whole-leu rounding rather than introducing a new tariff',()=>{expect(pricingSnapshot({...base,spaceType:'birou',sqm:11,creditLei:0}).grossBani).toBe(5000)});
 it('records express supplement separately',()=>{const s=pricingSnapshot({...base,expressFeeLei:100});expect(s.grossBani).toBe(88000);expect(s.lines[1].amountBani).toBe(10000)});
 it('rejects nonfinite values, unsafe amounts and excess credit',()=>{for(const patch of [{sqm:Infinity},{sqm:1.5},{creditLei:781},{expressFeeLei:NaN},{expressFeeLei:Number.MAX_VALUE},{creditLei:-1}])expect(()=>pricingSnapshot({...base,...patch})).toThrow()});
});

it('keeps the original record during price adjustments and rejects rewriting or clearing it',()=>{const db=new Database(':memory:');try{db.exec('CREATE TABLE jobs(id TEXT,price_gross INTEGER,pricing_snapshot TEXT);');db.exec(PRICING_SNAPSHOT_LOCK_SQL);db.prepare('INSERT INTO jobs VALUES(?,?,?)').run('j',780,'original');db.exec("UPDATE jobs SET price_gross=680 WHERE id='j'");expect(()=>db.exec("UPDATE jobs SET pricing_snapshot='changed' WHERE id='j'")).toThrow(/immutable/);expect(()=>db.exec("UPDATE jobs SET pricing_snapshot=NULL WHERE id='j'")).toThrow(/immutable/);expect(db.prepare('SELECT * FROM jobs').get()).toEqual({id:'j',price_gross:680,pricing_snapshot:'original'})}finally{db.close()}});
