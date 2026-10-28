import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import {NextRequest} from 'next/server';
const mocks=vi.hoisted(()=>({actor:vi.fn(),wake:vi.fn(()=>({scheduled:true})),resume:vi.fn(),queue:vi.fn(),db:{fixture:true}}));
vi.mock('@/lib/adminAuth',()=>({getAdminActorId:mocks.actor}));
vi.mock('@/lib/db',()=>({db:mocks.db}));
vi.mock('@/lib/adminMarketingScheduler',()=>({requestMarketingDeliveryProcessing:mocks.wake}));
vi.mock('@/lib/adminMarketingDelivery',()=>({cancelMarketingRun:vi.fn(),marketingCapturedMessages:vi.fn(),marketingDeliveryReport:vi.fn(),queueMarketingCampaign:mocks.queue,regrantMarketingContact:vi.fn(),resumeMarketingProvider:mocks.resume}));
import {POST} from './route';
beforeEach(()=>{vi.clearAllMocks();mocks.actor.mockResolvedValue('fixture-admin');vi.stubEnv('NEXT_PUBLIC_SITE_URL','https://sandbox.nitido.ro');});
afterEach(()=>vi.unstubAllEnvs());
function request(body:unknown,origin='https://sandbox.nitido.ro'){return new NextRequest('https://sandbox.nitido.ro/api/admin/marketing/delivery',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});}
it('wakes background delivery and returns without awaiting provider work',async()=>{
 const response=await POST(request({action:'process'}));expect(response.status).toBe(200);expect(await response.json()).toEqual({result:{scheduled:true}});expect(mocks.wake).toHaveBeenCalledWith(mocks.db);expect(mocks.queue).not.toHaveBeenCalled();
});
it('requires explicit confirmation to clear a provider hold and retains the admin/origin boundary',async()=>{
 expect((await POST(request({action:'resumeProvider'}))).status).toBe(400);expect(mocks.resume).not.toHaveBeenCalled();
 expect((await POST(request({action:'resumeProvider',confirmed:true},'https://evil.test'))).status).toBe(403);expect(mocks.resume).not.toHaveBeenCalled();
 mocks.actor.mockResolvedValue(null);expect((await POST(request({action:'process'}))).status).toBe(401);expect(mocks.wake).not.toHaveBeenCalled();
 mocks.actor.mockResolvedValue('fixture-admin');expect((await POST(request({action:'resumeProvider',confirmed:true}))).status).toBe(200);expect(mocks.resume).toHaveBeenCalledWith(mocks.db,'fixture-admin');
});
