import {afterEach,describe,expect,it,vi} from 'vitest';
import {sendEmail} from './email';
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals()});
describe('transactional email',()=>{
 it('does not report success when configuration is missing',async()=>{vi.stubEnv('RESEND_API_KEY','');vi.stubEnv('RESEND_FROM','');const fetch=vi.fn();vi.stubGlobal('fetch',fetch);expect(await sendEmail({to:'client@example.com',subject:'Welcome',html:'Welcome'})).toBe(false);expect(fetch).not.toHaveBeenCalled()});
 it.each([true,false])('returns provider acceptance %s',async(ok)=>{vi.stubEnv('RESEND_API_KEY','test-placeholder');vi.stubEnv('RESEND_FROM','NITIDO <mail@example.com>');vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok}));expect(await sendEmail({to:'client@example.com',subject:'Welcome',html:'Welcome'})).toBe(ok)});
 it('handles a network failure without rejecting account creation',async()=>{vi.stubEnv('RESEND_API_KEY','test-placeholder');vi.stubEnv('RESEND_FROM','mail@example.com');vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('offline')));expect(await sendEmail({to:'client@example.com',subject:'Welcome',html:'Welcome'})).toBe(false)});
});
