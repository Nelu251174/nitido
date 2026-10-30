import {describe,it,expect,vi} from 'vitest';
import {requestLogin} from './loginRequest';
const input={email:'client@example.test',password:' test password ',role:'client' as const};
const yes=()=>Response.json({ok:true,role:'client'}),none=()=>Response.json({user:null});
const current=(email=input.email,role='client')=>Response.json({user:{id:'synthetic',email,role}});
const use=(fn:ReturnType<typeof vi.fn>)=>fn as unknown as typeof fetch;
describe('login transport recovery',()=>{
 it('uses server-confirmed success and same-origin cookies',async()=>{const f=vi.fn().mockResolvedValue(yes());await expect(requestLogin(input,use(f))).resolves.toEqual({role:'client'});expect(f).toHaveBeenCalledTimes(1);const o=f.mock.calls[0][1];expect(o.credentials).toBe('same-origin');expect(JSON.parse(o.body).password).toBe(input.password);});
 it.each([401,409,429])('never retries or resumes a session after rejection %s',async status=>{const f=vi.fn().mockResolvedValue(Response.json({error:'Rejected'},{status}));await expect(requestLogin(input,use(f))).rejects.toThrow('Rejected');expect(f).toHaveBeenCalledTimes(1);});
 it('does not expose JSON parsing errors for a truncated rejection',async()=>{const f=vi.fn().mockResolvedValue(new Response('',{status:401}));await expect(requestLogin(input,use(f))).rejects.toThrow('Eroare la autentificare');expect(f).toHaveBeenCalledTimes(1);});
 it('recovers an empty success through the matching server session',async()=>{const f=vi.fn().mockResolvedValueOnce(new Response('')).mockResolvedValueOnce(current());await expect(requestLogin(input,use(f))).resolves.toEqual({role:'client'});expect(f).toHaveBeenCalledTimes(2);expect(f.mock.calls[1][0]).toBe('/api/auth/me');});
 it.each([new Response(''),new Response('<html>proxy failure</html>',{status:502})])('retries a transient incomplete response once',async response=>{const f=vi.fn().mockResolvedValueOnce(response).mockResolvedValueOnce(none()).mockResolvedValueOnce(yes());await expect(requestLogin(input,use(f))).resolves.toEqual({role:'client'});expect(f).toHaveBeenCalledTimes(3);});
 it('recovers after a network interruption without creating a second session',async()=>{const f=vi.fn().mockRejectedValueOnce(new TypeError('network')).mockResolvedValueOnce(current());await expect(requestLogin(input,use(f))).resolves.toEqual({role:'client'});expect(f).toHaveBeenCalledTimes(2);});
 it.each([['other@example.test','client'],[input.email,'firma']])('does not accept another account or role %s %s',async(email,role)=>{const f=vi.fn().mockImplementation(async(url:string)=>url==='/api/auth/me'?current(email,role):new Response(''));await expect(requestLogin(input,use(f))).rejects.toThrow('Conexiunea nu permite verificarea contului. Reîncearcă.');expect(f).toHaveBeenCalledTimes(4);});
 it.each([null,[],{ok:false,role:'client'},{ok:true,role:'firma'}])('never treats malformed success as authentication: %j',async value=>{const f=vi.fn().mockImplementation(async(url:string)=>url==='/api/auth/me'?none():Response.json(value));await expect(requestLogin(input,use(f))).rejects.toThrow('Conexiunea nu permite verificarea contului. Reîncearcă.');expect(f).toHaveBeenCalledTimes(4);});
});
