import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import Database from 'better-sqlite3';
import {NextRequest} from 'next/server';
const state=vi.hoisted(()=>({db:null as unknown as Database.Database,role:'client' as string|null,dbReads:0,rate:true}));
vi.mock('@/lib/db',()=>({get db(){state.dbReads++;return state.db;}}));
vi.mock('@/lib/auth',()=>({getCurrentUser:async()=>state.role?{id:'synthetic-owner',role:state.role}:null}));
vi.mock('@/lib/security',async original=>({...await original<typeof import('@/lib/security')>(),consumeRateLimit:()=>state.rate}));
import {POST} from './route';
import {ensureInternationalBookingSchema} from '@/lib/internationalBooking';
import {ensureInternationalTariffSchema} from '@/lib/internationalTariffs';
const body={countryCode:'AT',city:'Wien',spaceType:'apartament',service:'general',sqm:70};
function request(value:unknown=body,origin='https://sandbox.nitido.ro'){return new NextRequest('https://sandbox.nitido.ro/api/international/quote',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(value)});}
beforeEach(()=>{state.db=new Database(':memory:');state.db.exec("CREATE TABLE users(id TEXT PRIMARY KEY,role TEXT);CREATE TABLE jobs(id TEXT PRIMARY KEY);INSERT INTO users VALUES('synthetic-owner','client');");ensureInternationalBookingSchema(state.db);ensureInternationalTariffSchema(state.db);state.role='client';state.dbReads=0;state.rate=true;vi.stubEnv('NEXT_PUBLIC_SITE_URL','https://sandbox.nitido.ro');vi.stubEnv('NITIDO_ENABLE_INTERNATIONAL_PRICING','false');vi.stubEnv('STRIPE_SECRET_KEY','');});
afterEach(()=>{state.db.close();vi.unstubAllEnvs();});
it('rejects anonymous, firm and admin roles before database reads',async()=>{for(const role of [null,'firma','admin','super_admin']){state.role=role;expect((await POST(request())).status).toBe(401);}expect(state.dbReads).toBe(0);});
it('rejects untrusted origin and rate-limited requests',async()=>{expect((await POST(request(body,'https://attacker.invalid'))).status).toBe(403);state.rate=false;expect((await POST(request())).status).toBe(429);});
it('closed gate and unconfigured markets return422 without financial or quote mutation',async()=>{expect((await POST(request())).status).toBe(422);vi.stubEnv('NITIDO_ENABLE_INTERNATIONAL_PRICING','true');expect((await POST(request())).status).toBe(422);expect(state.db.prepare('SELECT COUNT(*) n FROM international_booking_quotes').get()).toEqual({n:0});});
it('explicit wrong countries/currency cannot fall back to RON and client cannot supply its amount',async()=>{for(const patch of [{countryCode:'US'},{countryCode:'RO'},{countryCode:undefined},{currency:'RON'},{grossMinor:1},{creditMinor:100},{workers:1}])expect((await POST(request({...body,...patch}))).status).toBe(400);});
it('never exposes internal errors and does not accept oversized payloads',async()=>{expect((await POST(request({...body,padding:'x'.repeat(6000)}))).status).toBe(413);const r=await POST(new NextRequest('https://sandbox.nitido.ro/api/international/quote',{method:'POST',headers:{Origin:'https://sandbox.nitido.ro'},body:'{'}));expect(r.status).toBe(400);});
