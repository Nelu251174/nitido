import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {NextRequest} from 'next/server';
const m=vi.hoisted(()=>({user:vi.fn(),create:vi.fn(),discard:vi.fn(),send:vi.fn(),configured:vi.fn(),rate:vi.fn()}));
vi.mock('@/lib/db',()=>({db:{},getUserByEmail:m.user}));
vi.mock('@/lib/passwordReset',()=>({createResetToken:m.create,discardResetToken:m.discard}));
vi.mock('@/lib/email',()=>({sendEmail:m.send,emailConfigured:m.configured}));
vi.mock('@/lib/security',async original=>({...await original<typeof import('@/lib/security')>(),consumeRateLimit:m.rate}));
import {POST} from './route';
const req=(body=JSON.stringify({email:' Client@Example.com '}),origin='https://sandbox.nitido.ro')=>new NextRequest('https://sandbox.nitido.ro/api/auth/forgot-password',{method:'POST',body,headers:{origin}});
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('NEXT_PUBLIC_SITE_URL','https://sandbox.nitido.ro');m.user.mockReturnValue({id:'a',email:'client@example.com'});m.create.mockReturnValue('a'.repeat(64));m.send.mockResolvedValue(true);m.configured.mockReturnValue(true);m.rate.mockReturnValue(true)});
afterEach(()=>vi.unstubAllEnvs());
describe('request password recovery',()=>{
 it.each(['null','[]','bad','{}',JSON.stringify({email:42}),JSON.stringify({email:'invalid'}),JSON.stringify({email:'a'.repeat(250)+'@example.com'})])('rejects malformed input %s before lookup',async body=>{expect((await POST(req(body))).status).toBe(400);expect(m.user).not.toHaveBeenCalled()});
 it('rejects foreign origins, oversized input and throttles before sending',async()=>{
  expect((await POST(req('{}','https://foreign.example'))).status).toBe(403);
  expect((await POST(req('x'.repeat(2001)))).status).toBe(413);
  m.rate.mockReturnValue(false);expect((await POST(req())).status).toBe(429);expect(m.send).not.toHaveBeenCalled();
 });
 it.each(['','http://sandbox.nitido.ro','https://user:pass@sandbox.nitido.ro','invalid'])('fails closed for unsafe configuration %s',async base=>{vi.stubEnv('NEXT_PUBLIC_SITE_URL',base);expect((await POST(req())).status).toBe(503);expect(m.user).not.toHaveBeenCalled();expect(m.create).not.toHaveBeenCalled()});
 it('fails equally without email configuration',async()=>{m.configured.mockReturnValue(false);expect((await POST(req())).status).toBe(503);expect(m.user).not.toHaveBeenCalled()});
 it('normalizes email and places token in fragment on configured origin',async()=>{
  vi.stubEnv('NEXT_PUBLIC_SITE_URL','https://sandbox.nitido.ro/unwanted?query=bad');
  const response=await POST(req());expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(m.user).toHaveBeenCalledWith('client@example.com');
  expect(m.send.mock.calls[0][0].html).toContain('https://sandbox.nitido.ro/reset-parola#'+'a'.repeat(64));
  expect(m.send.mock.calls[0][0].html).not.toContain('?token=');expect(m.discard).not.toHaveBeenCalled();
 });
 it('returns identical neutral responses for missing accounts and delivery outcomes',async()=>{
  const accepted=await (await POST(req())).json();
  m.send.mockResolvedValue(false);expect(await (await POST(req())).json()).toEqual(accepted);expect(m.discard).toHaveBeenCalledWith({},'a'.repeat(64));
  m.send.mockRejectedValue(new Error('private'));expect(await (await POST(req())).json()).toEqual(accepted);
  m.user.mockReturnValue(undefined);expect(await (await POST(req())).json()).toEqual(accepted);
  expect(accepted.message).not.toContain('ți-am trimis');
 });
});
