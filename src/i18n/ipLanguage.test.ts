import {describe,it,expect} from 'vitest';
import {NextRequest} from 'next/server';
import {proxy} from '@/proxy';
import {selectLocale} from './locales';

function forwardedCountry(ip:string,cookie?:string,pathname='/login'){
 const req=new NextRequest('https://nitido.ro'+pathname,{headers:{host:'nitido.ro','x-forwarded-for':ip,'accept-language':'en-US,en;q=0.9','x-nitido-country':'FR',...(cookie?{cookie}: {})}});
 const res=proxy(req);
 return res.headers.get('x-middleware-request-x-nitido-country');
}
describe('IP-first automatic language through the request proxy',()=>{
 it('resolves a Romanian IP despite English browser preferences and ignores forged country headers',()=>{
  const country=forwardedCountry('86.120.0.1');
  expect(country).toBe('RO');
  expect(selectLocale(null,'en-US,en;q=0.9',country)).toBe('ro');
 });
 it('uses the client address at the start of the proxy chain',()=>{
  expect(forwardedCountry('86.120.0.1, 172.18.0.1')).toBe('RO');
 });
 it('keeps a deliberate manual language selection above country detection',()=>{
  expect(forwardedCountry('86.120.0.1','nitido-language=en')).toBeNull();
  expect(selectLocale('en','ro-RO','RO')).toBe('en');
 });
 it('falls back to browser language when IP location is unavailable',()=>{
  const country=forwardedCountry('192.0.2.1');
  expect(country).toBeNull();
  expect(selectLocale(null,'en-US',country)).toBe('en');
 });
 it('keeps API and static requests outside the language location lookup',()=>{
  expect(forwardedCountry('86.120.0.1',undefined,'/api/health')).toBeNull();
  expect(forwardedCountry('86.120.0.1',undefined,'/offline.html')).toBeNull();
 });
});
