import {describe,it,expect} from 'vitest';
import {visitorCountry} from './visitorCountry';
const country=(ip:string)=>visitorCountry(new Headers({'x-forwarded-for':ip,'x-nitido-country':'FR','cf-ipcountry':'FR'}));
describe('coarse local IP country resolution',()=>{
 it('resolves RO, FR and US with the bundled database',()=>{expect(country('86.120.0.1')).toBe('RO');expect(country('82.64.0.1')).toBe('FR');expect(country('8.8.8.8')).toBe('US');});
 it('accepts mapped IPv4 and a trusted ingress proxy chain',()=>{expect(country('::ffff:86.120.0.1')).toBe('RO');expect(country('86.120.0.1, 172.18.0.1')).toBe('RO');});
 it.each(['unknown','','127.0.0.1','192.168.1.1','10.0.0.1','::1','fc00::1','192.0.2.1','2001:db8::1','bad:443','a'.repeat(100)])('does not invent a country for %s',ip=>expect(country(ip)).toBeNull());
 it('ignores forged country and browser language',()=>expect(visitorCountry(new Headers({'x-nitido-country':'FR','accept-language':'fr'}))).toBeNull());
});
