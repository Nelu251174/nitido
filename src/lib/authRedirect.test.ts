import {describe,it,expect} from 'vitest';
import {postAuthDestination,authSwitchHref} from './authRedirect';
describe('booking and invitation continuity across authentication',()=>{
 it('preserves the estimator when switching login → signup → login',()=>{const next='/client?spaceType=birou&sqm=100#sec-form';const signup=new URL(authSwitchHref('signup',next,'client'),'https://nitido.invalid');const login=new URL(authSwitchHref('login',signup.searchParams.get('next'),'client'),'https://nitido.invalid');expect(postAuthDestination(login.searchParams.get('next'),'client')).toBe(next)});
 it('preserves approval and invitation references for the appropriate account',()=>{expect(postAuthDestination('/client?propertyId=p&approvalId=a#sec-form','client')).toBe('/client?propertyId=p&approvalId=a#sec-form');expect(postAuthDestination('/invitatie?token=example-test-token','firma')).toBe('/invitatie?token=example-test-token');expect(postAuthDestination('/client','firma')).toBe('/firma')});
 it.each(['https://other.example','//other.example','/\\other.example','/client/../../admin','/client/%2e%2e/admin','/client\n/other'])('rejects unsafe return path %s',next=>{expect(postAuthDestination(next,'client')).toBe('/client')});
});
