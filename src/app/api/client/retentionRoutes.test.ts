import {beforeEach,it,expect,vi} from 'vitest';
import {NextRequest} from 'next/server';
const state=vi.hoisted(()=>({user:null as null|{id:string;role:string}}));
vi.mock('@/lib/auth',()=>({getCurrentUser:vi.fn(async()=>state.user)}));
vi.mock('@/lib/db',()=>({db:{prepare:vi.fn(()=>({all:()=>[],get:()=>undefined}))}}));
vi.mock('@/lib/clientRetention',()=>({favoriteFirms:vi.fn(()=>[]),saveFavorite:vi.fn(),repeatBookingValues:vi.fn(()=>({repeatJobId:'owned'})),RetentionError:class extends Error{status=400}}));
vi.mock('@/lib/availabilityAlerts',()=>({availabilityAlertsEnabled:()=>true,alertChannels:()=>({inapp:true,email:false,push:false}),subscribeAvailability:vi.fn(()=> 'synthetic-id'),unsubscribeAvailability:vi.fn(),batchMatches:vi.fn(()=>[]),processAvailabilityAlerts:vi.fn()}));
import {GET as favoriteGet,POST as favoritePost} from './favorites/route';
import {GET as alertsGet,POST as alertsPost} from './availability-alerts/route';
import {GET as repeatGet} from '../jobs/[id]/repeat/route';
import {POST as cronPost} from '../cron/availability-alerts/route';
import {saveFavorite,favoriteFirms,repeatBookingValues} from '@/lib/clientRetention';
import {subscribeAvailability,batchMatches,processAvailabilityAlerts} from '@/lib/availabilityAlerts';
const request=(path:string,body?:unknown,origin='https://nitido.ro')=>new NextRequest('https://nitido.ro'+path,body===undefined?{}:{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
beforeEach(()=>{state.user=null;vi.clearAllMocks()});
it('rejects unauthenticated reads and all non-client mutations',async()=>{
  expect((await favoriteGet(request('/api/client/favorites'))).status).toBe(401);expect((await alertsGet(request('/api/client/availability-alerts'))).status).toBe(401);expect((await repeatGet(request('/api/jobs/x/repeat'),{params:Promise.resolve({id:'x'})})).status).toBe(401);
  state.user={id:'firm-user',role:'firma'};expect((await favoritePost(request('/api/client/favorites',{}))).status).toBe(401);expect((await alertsPost(request('/api/client/availability-alerts',{}))).status).toBe(401);
  expect(saveFavorite).not.toHaveBeenCalled();expect(subscribeAvailability).not.toHaveBeenCalled();
});
it('rejects foreign-origin mutations before any write',async()=>{
  state.user={id:'c',role:'client'};expect((await favoritePost(request('/api/client/favorites',{firmId:'f',save:true},'https://attacker.test'))).status).toBe(403);expect((await alertsPost(request('/api/client/availability-alerts',{action:'subscribe'},'https://attacker.test'))).status).toBe(403);expect(saveFavorite).not.toHaveBeenCalled();expect(subscribeAvailability).not.toHaveBeenCalled();
});
it('uses the session client, ignoring a forged clientId and authenticates repeat drafts',async()=>{
  state.user={id:'c',role:'client'};const get=await favoriteGet(request('/api/client/favorites?clientId=other'));expect(get.headers.get('Cache-Control')).toContain('no-store');expect(favoriteFirms).toHaveBeenCalledWith(expect.anything(),'c');
  expect((await favoritePost(request('/api/client/favorites',{firmId:'f',save:true,clientId:'other'}))).status).toBe(200);expect(saveFavorite).toHaveBeenCalledWith(expect.anything(),'c','f',true);
  await repeatGet(request('/api/jobs/owned/repeat?clientId=other'),{params:Promise.resolve({id:'owned'})});expect(repeatBookingValues).toHaveBeenCalledWith(expect.anything(),'c','owned');
});
it('does not coerce missing or malformed preference flags; keeps batch reads tenant-bound',async()=>{
  state.user={id:'c',role:'client'};expect((await favoritePost(request('/api/client/favorites',{firmId:'f',save:'true'}))).status).toBe(400);expect(saveFavorite).not.toHaveBeenCalled();
  expect((await alertsGet(request('/api/client/availability-alerts?batch=someone-elses-batch'))).status).toBe(404);expect(batchMatches).not.toHaveBeenCalled();
});
it('a subscription always belongs to the signed-in client, and cron cannot be called without its secret',async()=>{
  state.user={id:'c',role:'client'};expect((await alertsPost(request('/api/client/availability-alerts',{action:'subscribe',clientId:'other',consent:true,channels:['inapp']}))).status).toBe(201);expect(subscribeAvailability).toHaveBeenCalledWith(expect.anything(),'c',expect.anything());
  expect((await cronPost(request('/api/cron/availability-alerts',{}))).status).toBe(401);expect(processAvailabilityAlerts).not.toHaveBeenCalled();
});
