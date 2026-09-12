import {beforeEach,describe,it,expect,vi} from 'vitest';
import {NextRequest} from 'next/server';
const mocks=vi.hoisted(()=>({user:vi.fn(),rate:vi.fn(),card:vi.fn(),create:vi.fn(),change:vi.fn(),generate:vi.fn(),plans:vi.fn(),occurrences:vi.fn(),pause:vi.fn(),removePause:vi.fn()}));
vi.mock('@/lib/auth',()=>({getCurrentUser:mocks.user}));
vi.mock('@/lib/db',()=>({db:{}}));
vi.mock('@/lib/clientPayments',()=>({getClientCardInfo:mocks.card}));
vi.mock('@/lib/security',async original=>({...await original<typeof import('@/lib/security')>(),consumeRateLimit:mocks.rate}));
vi.mock('@/lib/recurring',async original=>({...await original<typeof import('@/lib/recurring')>(),createRecurringPlan:mocks.create,setPlanStatus:mocks.change,schedulePlanPause:mocks.pause,removePlanPause:mocks.removePause,generateDueRecurringJobs:mocks.generate,listPlansForClient:mocks.plans,listRecurringOccurrences:mocks.occurrences}));
import {GET,POST} from './route';
import {POST as change} from './[id]/route';
const req=(body='{}',origin='https://sandbox.nitido.ro')=>new NextRequest('https://sandbox.nitido.ro/api/recurring',{method:'POST',body,headers:{origin,'content-type':'application/json'}});
const input={frequency:'weekly',street:'Test',city:'Constanța',sqm:75,spaceType:'apartament',hour:10,startDate:'2026-10-01'};
const params={params:Promise.resolve({id:'p'})};
beforeEach(()=>{vi.clearAllMocks();mocks.user.mockResolvedValue({id:'c',role:'client'});mocks.rate.mockReturnValue(true);mocks.card.mockReturnValue({stripeConfigured:false,hasCard:false});mocks.create.mockReturnValue({ok:true,planId:'p'});mocks.change.mockReturnValue({ok:true,planId:'p'})});
describe('recurring request boundaries',()=>{
 it('rejects foreign-origin creation and status changes before side effects',async()=>{expect((await POST(req(JSON.stringify(input),'https://foreign.example'))).status).toBe(403);expect((await change(req('{"status":"paused"}','https://foreign.example'),params)).status).toBe(403);expect(mocks.card).not.toHaveBeenCalled();expect(mocks.create).not.toHaveBeenCalled();expect(mocks.change).not.toHaveBeenCalled()});
 it('rejects unauthenticated and firm requests',async()=>{for(const user of [null,{id:'f',role:'firma'}]){mocks.user.mockResolvedValue(user);expect((await POST(req())).status).toBe(401);expect((await change(req(),params)).status).toBe(401)}});
 it('rejects invalid and oversized bodies on both mutation routes',async()=>{for(const [body,status] of [['bad',400],['null',400],['[]',400],['x'.repeat(10001),413]] as const){expect((await POST(req(body))).status).toBe(status);expect((await change(req(body),params)).status).toBe(status)}expect(mocks.card).not.toHaveBeenCalled();expect(mocks.change).not.toHaveBeenCalled()});
 it('requires assessment before checking the card for oversized properties',async()=>{expect((await POST(req(JSON.stringify({...input,sqm:1001})))).status).toBe(422);expect(mocks.card).not.toHaveBeenCalled();expect(mocks.create).not.toHaveBeenCalled()});
 it('takes ownership from the session and accepts valid data',async()=>{expect((await POST(req(JSON.stringify({...input,clientId:'foreign'})))).status).toBe(201);expect(mocks.create).toHaveBeenCalledWith({},expect.objectContaining({clientId:'c',sqm:75}))});
 it('limits mutation frequency before card or storage operations',async()=>{mocks.rate.mockReturnValue(false);expect((await POST(req(JSON.stringify(input)))).status).toBe(429);expect((await change(req('{"status":"paused"}'),params)).status).toBe(429);expect(mocks.card).not.toHaveBeenCalled();expect(mocks.change).not.toHaveBeenCalled()});
 it('listing subscriptions never triggers creation or authorization',async()=>{mocks.plans.mockReturnValue([]);mocks.occurrences.mockReturnValue([]);const response=await GET(new NextRequest('https://sandbox.nitido.ro/api/recurring'));expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toBe('private, no-store');expect(mocks.generate).not.toHaveBeenCalled();expect(mocks.create).not.toHaveBeenCalled();expect(mocks.card).not.toHaveBeenCalled()});
 it('explicit generation is restricted to the authenticated client',async()=>{mocks.generate.mockResolvedValue({created:['j1']});const response=await POST(req(JSON.stringify({action:'generate',clientId:'foreign'})));expect(await response.json()).toEqual({ok:true,created:1});expect(mocks.generate).toHaveBeenCalledWith({},expect.any(Date),'c')});
 it('blocks foreign-origin generation and unknown actions',async()=>{expect((await POST(req('{"action":"generate"}','https://foreign.example'))).status).toBe(403);expect((await POST(req('{"action":"unknown"}'))).status).toBe(400);expect(mocks.generate).not.toHaveBeenCalled()});

 it('pause interval uses session ownership and rejects foreign origins',async()=>{
   mocks.pause.mockReturnValue({ok:true,planId:'p'});
   const body=JSON.stringify({action:'pause_interval',clientId:'foreign',startDate:'2026-10-01',endDate:'2026-10-15'});
   expect((await change(req(body,'https://foreign.example'),params)).status).toBe(403);
   expect(mocks.pause).not.toHaveBeenCalled();
   expect((await change(req(body),params)).status).toBe(200);
   expect(mocks.pause).toHaveBeenCalledWith({},'p','c','2026-10-01','2026-10-15');
   mocks.pause.mockReturnValue({ok:false,status:409,error:'Active visits'});
   expect((await change(req(body),params)).status).toBe(409);
 });

 it('validates end dates before card checks and forwards valid limits',async()=>{
   expect((await POST(req(JSON.stringify({...input,endDate:'2026-09-30'})))).status).toBe(400);
   expect(mocks.card).not.toHaveBeenCalled();
   expect((await POST(req(JSON.stringify({...input,endDate:'2026-10-31'})))).status).toBe(201);
   expect(mocks.create).toHaveBeenCalledWith({},expect.objectContaining({endDate:'2026-10-31'}));
 });

 it('removing a pause uses session ownership and rejects stale intervals and foreign origins',async()=>{
   mocks.removePause.mockReturnValue({ok:true,planId:'p'});
   const body=JSON.stringify({action:'remove_pause',clientId:'foreign',startDate:'2026-10-01',endDate:'2026-10-15'});
   expect((await change(req(body,'https://foreign.example'),params)).status).toBe(403);
   expect(mocks.removePause).not.toHaveBeenCalled();
   expect((await change(req(body),params)).status).toBe(200);
   expect(mocks.removePause).toHaveBeenCalledWith({},'p','c','2026-10-01','2026-10-15');
   mocks.removePause.mockReturnValue({ok:false,status:409,error:'Updated interval'});
   expect((await change(req(body),params)).status).toBe(409);
 });

});
