import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {sendEmail,sendEmailResult} from './email';
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();vi.restoreAllMocks();vi.useRealTimers()});
describe('transactional email',()=>{
 it('does not report success when configuration is missing',async()=>{vi.stubEnv('RESEND_API_KEY','');vi.stubEnv('RESEND_FROM','');const fetch=vi.fn();vi.stubGlobal('fetch',fetch);expect(await sendEmail({to:'client@example.com',subject:'Welcome',html:'Welcome'})).toBe(false);expect(fetch).not.toHaveBeenCalled()});
 it.each([true,false])('returns provider acceptance %s',async(ok)=>{vi.stubEnv('RESEND_API_KEY','test-placeholder');vi.stubEnv('RESEND_FROM','NITIDO <mail@example.com>');vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok}));expect(await sendEmail({to:'client@example.com',subject:'Welcome',html:'Welcome'})).toBe(ok)});
 it('handles a network failure without rejecting account creation',async()=>{vi.stubEnv('RESEND_API_KEY','test-placeholder');vi.stubEnv('RESEND_FROM','mail@example.com');vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('offline')));expect(await sendEmail({to:'client@example.com',subject:'Welcome',html:'Welcome'})).toBe(false)});
});

describe('redacted provider diagnostic',()=>{
 const opts={to:'recipient-private@example.test',subject:'PRIVATE_SUBJECT',html:'PRIVATE_BODY'};
 const messageId='f7acfd49-d6e8-43dc-9a4b-b429c71aba3d';
 beforeEach(()=>{vi.stubEnv('RESEND_API_KEY','PRIVATE_KEY');vi.stubEnv('RESEND_FROM','NITIDO <mail@example.test>')});
 it.each([401,403,422,429,500,503])('classifies HTTP%s without reading its sensitive error body',async(status)=>{
  const response=new Response('PRIVATE_PROVIDER_ERROR recipient-private@example.test PRIVATE_KEY',{status});
  const json=vi.spyOn(response,'json'),text=vi.spyOn(response,'text');vi.stubGlobal('fetch',vi.fn().mockResolvedValue(response));
  const result=await sendEmailResult(opts);
  expect(result).toMatchObject({accepted:false,stage:'provider',httpStatus:status,attempts:1,messageId:null});
  expect(result.category).toBe(status===401?'provider_unauthorized':status===403?'provider_forbidden':status===429?'provider_rate_limited':status>=500?'provider_unavailable':'provider_rejected');
  expect(json).not.toHaveBeenCalled();expect(text).not.toHaveBeenCalled();expect(JSON.stringify(result)).not.toMatch(/PRIVATE_|recipient-private/);
 });
 it('retains only the safe acceptance receipt and never calls acceptance delivery',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({id:messageId,secret:'PRIVATE_PROVIDER_BODY'})));
  const result=await sendEmailResult(opts);expect(result).toMatchObject({accepted:true,messageId,category:'provider_accepted',httpStatus:200});
  expect(result.correlationId).toMatch(/^[a-f0-9-]{36}$/);expect(JSON.stringify(result)).not.toMatch(/PRIVATE_|delivered/);
 });
 it.each([{}, {id:'recipient-private@example.test'}, {id:'PRIVATE_BODY'}, {id:17}])('does not resend an accepted email when the receipt ID is unusable',async(body)=>{
  const transport=vi.fn().mockResolvedValue(Response.json(body));vi.stubGlobal('fetch',transport);
  expect(await sendEmailResult({...opts,idempotencyKey:'fixture-key'},{retryTransient:true})).toMatchObject({accepted:true,messageId:null,attempts:1});expect(transport).toHaveBeenCalledTimes(1);
 });
 it('keeps HTTP acceptance when the receipt is malformed JSON',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('not-json',{status:202})));
  expect(await sendEmailResult(opts)).toMatchObject({accepted:true,messageId:null,httpStatus:202});
 });
 it.each(['invalid sender','Bad <no-domain>','mail@example.test\r\nBcc: private@example.test'])('rejects malformed sender configuration before any request',async(sender)=>{
  vi.stubEnv('RESEND_FROM',sender);const transport=vi.fn();vi.stubGlobal('fetch',transport);
  expect(await sendEmailResult(opts)).toMatchObject({accepted:false,stage:'configuration',category:'invalid_sender',attempts:0});expect(transport).not.toHaveBeenCalled();
 });
 it.each(['TimeoutError','AbortError','Error'])('redacts %s transport exceptions',async(name)=>{
  vi.stubGlobal('fetch',vi.fn().mockRejectedValue(Object.assign(new Error('PRIVATE_BODY PRIVATE_KEY'),{name})));
  const result=await sendEmailResult(opts);expect(result.category).toBe(name==='Error'?'transport_error':'transport_timeout');expect(result.httpStatus).toBeNull();expect(JSON.stringify(result)).not.toContain('PRIVATE_');
 });
 it('retries a transient failure once with the same idempotency key and the same total timeout signal',async()=>{
  const transport=vi.fn().mockResolvedValueOnce(new Response('private',{status:503,headers:{'Retry-After':'0'}})).mockResolvedValueOnce(Response.json({id:messageId}));vi.stubGlobal('fetch',transport);
  const result=await sendEmailResult({...opts,idempotencyKey:'verification-fixture'},{retryTransient:true});
  expect(result).toMatchObject({accepted:true,attempts:2,messageId});expect(transport).toHaveBeenCalledTimes(2);
  const first=transport.mock.calls[0][1],second=transport.mock.calls[1][1];expect(first.signal).toBe(second.signal);expect(first.headers['Idempotency-Key']).toBe('verification-fixture');expect(second.headers['Idempotency-Key']).toBe('verification-fixture');
 });
 it('enforces one eight-second deadline across the retry rather than two separate timeouts',async()=>{
  vi.useFakeTimers();const controller=new AbortController();const timeout=vi.spyOn(AbortSignal,'timeout').mockImplementation(ms=>{setTimeout(()=>controller.abort(),ms);return controller.signal});
  const transport=vi.fn().mockResolvedValueOnce(new Response('private',{status:503,headers:{'Retry-After':'0'}})).mockImplementationOnce((_url:unknown,init:RequestInit)=>new Promise((_resolve,reject)=>{init.signal!.addEventListener('abort',()=>reject(Object.assign(new Error('PRIVATE_TIMEOUT'),{name:'AbortError'})))}));vi.stubGlobal('fetch',transport);
  let finished=false;const pending=sendEmailResult({...opts,idempotencyKey:'verification-fixture'},{retryTransient:true}).then(result=>{finished=true;return result});
  await vi.advanceTimersByTimeAsync(7999);expect(finished).toBe(false);expect(transport).toHaveBeenCalledTimes(2);await vi.advanceTimersByTimeAsync(1);
  expect(await pending).toMatchObject({accepted:false,category:'transport_timeout',attempts:2});expect(timeout).toHaveBeenCalledTimes(1);expect(timeout).toHaveBeenCalledWith(8000);
 });
 it('does not retry a long rate limit or a send without an idempotency key',async()=>{
  const transport=vi.fn().mockImplementation(()=>Promise.resolve(new Response('private',{status:429,headers:{'Retry-After':'120'}})));vi.stubGlobal('fetch',transport);
  expect(await sendEmailResult({...opts,idempotencyKey:'verification-fixture'},{retryTransient:true})).toMatchObject({accepted:false,attempts:1,retryAfterSeconds:120});
  expect(await sendEmailResult(opts,{retryTransient:true})).toMatchObject({accepted:false,attempts:1});expect(transport).toHaveBeenCalledTimes(2);
 });
 it('does not add retry side effects for legacy boolean callers',async()=>{
  const transport=vi.fn().mockResolvedValue(new Response('private',{status:503}));vi.stubGlobal('fetch',transport);expect(await sendEmail({...opts,idempotencyKey:'existing-flow'})).toBe(false);expect(transport).toHaveBeenCalledTimes(1);
 });
 it('replaces a caller-controlled non-opaque correlation value',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({id:messageId})));const result=await sendEmailResult(opts,{correlationId:'recipient-private@example.test'});expect(JSON.stringify(result)).not.toContain('recipient-private');
 });
});
