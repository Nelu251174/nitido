import {describe,expect,it,vi} from 'vitest';
import {ApiError} from './apiCore';
import {readDeletionRequest,requestAccountDeletion} from './accountDeletionCore';
import {requestPasswordRecovery} from './passwordRecoveryCore';
describe('account lifecycle backend contracts',()=>{
 it('reads and creates a deletion request without sending another user identity',async()=>{
  const request=vi.fn().mockResolvedValue({request:{id:'request-1',status:'requested'},message:'Înregistrată'});
  await readDeletionRequest(request);await requestAccountDeletion(request);
  expect(request.mock.calls).toEqual([['/api/account/deletion'],['/api/account/deletion',{method:'POST',body:'{"confirmation":"DELETE_ACCOUNT"}'}]]);
 });
 it('keeps a replayed pending request instead of claiming the account was deleted',async()=>{
  const replay={request:{id:'request-1',status:'under_review'},message:'În analiză',replayed:true};
  expect(await requestAccountDeletion(vi.fn().mockResolvedValue(replay))).toEqual(replay);
 });
 it('rejects unconfirmed deletion responses',async()=>{
  for(const result of [{ok:true},{request:null},{request:{id:'r',status:'deleted'}}])await expect(requestAccountDeletion(vi.fn().mockResolvedValue(result))).rejects.toThrow('confirmat');
 });
 it('preserves expired auth and retry failures rather than pretending a request exists',async()=>{
  const failure=new ApiError('Sesiune expirată',401);await expect(requestAccountDeletion(vi.fn().mockRejectedValue(failure))).rejects.toBe(failure);
 });
 it('normalizes an email and displays only the generic response returned by the server',async()=>{
  const request=vi.fn().mockResolvedValue({ok:true,message:'Dacă există contul, vei primi un link.'});
  expect(await requestPasswordRecovery(' PERSON@EXAMPLE.RO ',request)).toBe('Dacă există contul, vei primi un link.');
  expect(request).toHaveBeenCalledWith('/api/auth/forgot-password',{method:'POST',body:'{"email":"person@example.ro"}'});
 });
 it('does not send invalid email or infer delivery when unavailable',async()=>{
  const request=vi.fn();for(const email of ['bad','p @test.ro','a'.repeat(255)+'@test.ro'])await expect(requestPasswordRecovery(email,request)).rejects.toThrow('validă');expect(request).not.toHaveBeenCalled();
  request.mockRejectedValue(new ApiError('Email indisponibil',503));await expect(requestPasswordRecovery('p@test.ro',request)).rejects.toMatchObject({status:503});
  await expect(requestPasswordRecovery('p@test.ro',vi.fn().mockResolvedValue({ok:true}))).rejects.toThrow('confirmată');
 });
});
