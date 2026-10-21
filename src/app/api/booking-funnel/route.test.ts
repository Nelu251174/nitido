import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import Database from 'better-sqlite3';
import {NextRequest} from 'next/server';
import {migratePro} from '@/lib/pro/schema';
import {bookingFunnelReport} from '@/lib/bookingFunnelReport';
const state=vi.hoisted(()=>({db:null as unknown as Database.Database}));
vi.mock('@/lib/db',()=>({get db(){return state.db;}}));
import {POST} from './route';
beforeEach(()=>{state.db=new Database(':memory:');migratePro(state.db);state.db.exec("CREATE TABLE jobs(id TEXT,created_at TEXT,accepted_firm_id TEXT,status TEXT)");vi.stubEnv('NEXT_PUBLIC_SITE_URL','https://nitido.ro');});
afterEach(()=>{state.db.close();vi.unstubAllEnvs();});
const post=(b:unknown,origin='https://nitido.ro')=>POST(new NextRequest('https://nitido.ro/api/booking-funnel',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(b)}));
it('rejects missing consent and untrusted origins without persisting an event',async()=>{
 const b={session:crypto.randomUUID(),event:'start',device:'mobile'};expect((await post(b)).status).toBe(422);expect((await post({...b,consent:true},'https://other.test')).status).toBe(403);expect(state.db.prepare('SELECT count(*) n FROM pro_audit_logs').get()).toEqual({n:0});
});
it('stores only bounded event categories and deduplicates server-side retries',async()=>{
 const b={session:crypto.randomUUID(),event:'start',device:'mobile',consent:true,address:'PRIVATE',price:0};
 expect((await post(b)).status).toBe(204);expect((await post(b)).status).toBe(204);expect((await post({...b,event:'published'})).status).toBe(422);
 const rows=state.db.prepare('SELECT * FROM pro_audit_logs').all();expect(rows).toHaveLength(1);expect(JSON.stringify(rows)).not.toContain('PRIVATE');expect(JSON.stringify(rows)).not.toContain('price');
});
it('keeps authoritative request counts separate from consent-limited session counts with Romanian dates',()=>{
 state.db.prepare('INSERT INTO jobs VALUES(?,?,?,?)').run('one','2026-10-20T21:30:00Z','firm','completed');state.db.prepare('INSERT INTO jobs VALUES(?,?,?,?)').run('outside','2026-10-20T19:00:00Z',null,'posted');
 const report=bookingFunnelReport(state.db,'2026-10-21','2026-10-21');expect(report.jobs).toEqual({published:1,allocated:1,completed:1});expect(report.steps).toEqual([]);expect(()=>bookingFunnelReport(state.db,'2026-01-01','2026-10-21')).toThrow();
});
