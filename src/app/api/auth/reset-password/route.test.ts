import {beforeEach,describe,it,expect,vi} from 'vitest';
import {NextRequest} from 'next/server';
const mocks=vi.hoisted(()=>({hash:vi.fn(),apply:vi.fn(),rate:vi.fn()}));
vi.mock('@/lib/db',()=>({db:{}}));
vi.mock('@/lib/auth',()=>({hashPassword:mocks.hash}));
vi.mock('@/lib/passwordReset',()=>({applyPasswordReset:mocks.apply}));
vi.mock('@/lib/security',async original=>({...await original<typeof import('@/lib/security')>(),consumeRateLimit:mocks.rate}));
import {POST} from './route';
const token='a'.repeat(64);
const req=(body=JSON.stringify({token,password:'StrongPassword123'}),origin='https://sandbox.nitido.ro')=>new NextRequest('https://sandbox.nitido.ro/api/auth/reset-password',{method:'POST',body,headers:{origin}});
beforeEach(()=>{vi.clearAllMocks();mocks.rate.mockReturnValue(true);mocks.hash.mockResolvedValue('hash');mocks.apply.mockReturnValue(true)});
describe('password reset request boundary',()=>{
 it.each(['null','[]','bad',JSON.stringify({token:3,password:'StrongPassword123'}),JSON.stringify({token,password:{}}),JSON.stringify({token,password:'x'.repeat(73)+'1'})])('rejects invalid input %s before hashing',async body=>{expect((await POST(req(body))).status).toBe(400);expect(mocks.hash).not.toHaveBeenCalled();expect(mocks.apply).not.toHaveBeenCalled()});
 it('blocks foreign origins, oversize bodies and rate limits',async()=>{
  expect((await POST(req('{}','https://foreign.example'))).status).toBe(403);
  expect((await POST(req('x'.repeat(2001)))).status).toBe(413);
  mocks.rate.mockReturnValue(false);expect((await POST(req())).status).toBe(429);
  expect(mocks.hash).not.toHaveBeenCalled();expect(mocks.apply).not.toHaveBeenCalled();
 });
 it('does not consume a link if hashing fails',async()=>{
  mocks.hash.mockRejectedValue(new Error('private internals'));
  const response=await POST(req());expect(response.status).toBe(503);
  expect(JSON.stringify(await response.json())).not.toContain('private internals');expect(mocks.apply).not.toHaveBeenCalled();
 });
 it('rechecks authority after hashing yields and reports only one success',async()=>{
  let finish!:(value:string)=>void;
  mocks.hash.mockImplementationOnce(()=>new Promise<string>(resolve=>{finish=resolve})).mockResolvedValue('second-hash');
  mocks.apply.mockReturnValueOnce(true).mockReturnValueOnce(false);
  const first=POST(req());
  await vi.waitFor(()=>expect(mocks.hash).toHaveBeenCalledTimes(1));
  const second=await POST(req());expect(second.status).toBe(200);
  finish('first-hash');expect((await first).status).toBe(400);
  expect(mocks.apply.mock.calls.map(call=>call[2])).toEqual(['second-hash','first-hash']);
 });
 it('returns retryable generic failure on storage errors and does not cache responses',async()=>{
  mocks.apply.mockImplementation(()=>{throw new Error('sqlite details')});
  const response=await POST(req());expect(response.status).toBe(503);expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(JSON.stringify(await response.json())).not.toContain('sqlite details');
 });
});
