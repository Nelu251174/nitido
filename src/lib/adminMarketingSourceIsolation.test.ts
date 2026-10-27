import {afterEach,expect,it,vi} from 'vitest';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {spawn} from 'node:child_process';
import {prepareMarketingCountySource} from './adminMarketingCounty';
vi.mock('node:child_process',()=>({spawn:vi.fn()}));
afterEach(()=>{vi.unstubAllEnvs();vi.clearAllMocks();});
it('keeps public source preparation isolated and email-disabled when the application enables manual delivery',async()=>{
 vi.stubEnv('NEXT_PUBLIC_SITE_URL','https://nitido.ro');vi.stubEnv('NITIDO_MARKETING_DELIVERY_ENABLED','true');
 vi.stubEnv('RESEND_API_KEY','synthetic-key');vi.stubEnv('NITIDO_MARKETING_WEBHOOK_SECRET','synthetic-secret');vi.stubEnv('COOLIFY_TOKEN','synthetic-token');
 const child=Object.assign(new EventEmitter(),{stdout:new PassThrough(),kill:vi.fn()});
 vi.mocked(spawn).mockImplementation((()=>{queueMicrotask(()=>child.emit('exit',0));return child;}) as unknown as typeof spawn);
 await prepareMarketingCountySource('B',()=>true,()=>{});
 const [bin,args,options]=vi.mocked(spawn).mock.calls[0];
 expect(bin).toBe(process.execPath);expect(args).toContain('--county=B');expect(args).toContain('--live');
 expect(options?.env).toMatchObject({NEXT_PUBLIC_SITE_URL:'https://nitido.ro',NITIDO_MARKETING_DELIVERY_ENABLED:'false'});
 for(const key of ['RESEND_API_KEY','NITIDO_MARKETING_WEBHOOK_SECRET','COOLIFY_TOKEN'])expect(options?.env).not.toHaveProperty(key);
 expect(child.kill).not.toHaveBeenCalled();
});
