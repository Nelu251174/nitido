import {describe,it,expect} from 'vitest';
import {readVerificationStatus,readResendResult,verificationDescription} from './emailVerificationCore';
describe('mobile email verification',()=>{
 it('never interprets missing or malformed state as verified',()=>{for(const value of [null,{},true,{verified:'true',configured:true},{verified:true}])expect(()=>readVerificationStatus(value)).toThrow()});
 it('distinguishes verified pending and unavailable',()=>{expect(verificationDescription(readVerificationStatus({verified:true,configured:false}))).toContain('este confirmată');expect(verificationDescription({verified:false,configured:true})).toContain('24 de ore');expect(verificationDescription({verified:false,configured:false})).toContain('neconfirmată')});
 it('distinguishes provider acceptance from confirmation',()=>{expect(readResendResult({accepted:true})).toBe('accepted');expect(readResendResult({verified:true})).toBe('verified');for(const value of [null,{}, {ok:true},{accepted:false},{accepted:'true'}])expect(()=>readResendResult(value)).toThrow()});
});
