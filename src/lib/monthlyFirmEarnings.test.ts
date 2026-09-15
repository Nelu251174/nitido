import {beforeEach,afterEach,it,expect} from 'vitest';
import Sqlite from 'better-sqlite3';
import {SCHEMA_SQL} from './db';
import {earningsForMonth,bucharestDay} from './monthlyFirmEarnings';
let db:Sqlite.Database;
beforeEach(()=>{db=new Sqlite(':memory:');db.exec(SCHEMA_SQL);db.exec(`INSERT INTO users(id,role,name) VALUES('c','client','Client Test'),('f','firma','Firma'),('other','firma','Other');INSERT INTO firms(id,user_id,coverage_city) VALUES('firm','f','Constanța');INSERT INTO jobs(id,client_id,street,city,sqm,space_type,when_type,price_gross,duration_minutes,status,accepted_firm_id,arrived_confirmed_at,completed_at) VALUES('j','c','Test','Constanța',80,'apartament','scheduled',550,150,'completed','firm','2026-08-31 21:00:00','2026-08-31 22:00:00');INSERT INTO payments(id,job_id,amount_gross,commission_amount,amount_net,status) VALUES('p','j',550,113,437,'captured');`);});
afterEach(()=>db.close());
it('uses the Romanian completion day, stored amounts, client and recorded duration',()=>{expect(earningsForMonth(db,'f','2026-09')).toMatchObject([{day:'2026-09-01',clientName:'Client Test',recordedMinutes:60,estimatedMinutes:150,net:437,confirmedNet:437}]);expect(earningsForMonth(db,'f','2026-08')).toEqual([]);});
it('isolates firms and rejects malformed months',()=>{expect(earningsForMonth(db,'other','2026-09')).toEqual([]);expect(earningsForMonth(db,'c','2026-09')).toEqual([]);expect(()=>earningsForMonth(db,'f','2026-13')).toThrow();});
it.each(['authorized','refunded','cancelled'])('does not count %s as confirmed earnings',status=>{db.prepare('UPDATE payments SET status=?').run(status);expect(earningsForMonth(db,'f','2026-09')[0].confirmedNet).toBe(0);});
it('excludes refunds and disputes from confirmed earnings',()=>{db.exec("UPDATE payments SET refund_status='pending'");expect(earningsForMonth(db,'f','2026-09')[0].confirmedNet).toBe(0);db.exec("UPDATE payments SET refund_status='none',dispute_status='open'");expect(earningsForMonth(db,'f','2026-09')[0].confirmedNet).toBe(0);});
it('does not invent a duration without a valid arrival',()=>{db.exec('UPDATE jobs SET arrived_confirmed_at=NULL');expect(earningsForMonth(db,'f','2026-09')[0].recordedMinutes).toBeNull();});
it('applies winter and summer offsets',()=>{expect(bucharestDay('2026-01-01 21:30:00')).toBe('2026-01-01');expect(bucharestDay('2026-07-01 21:30:00')).toBe('2026-07-02');});

it("does not expose client totals or platform commission to firms",()=>{const row=earningsForMonth(db,"f","2026-09")[0];expect(row).not.toHaveProperty("commission");expect(row).not.toHaveProperty("gross");expect(row.net).toBe(437);});
