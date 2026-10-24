import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
const mocks=vi.hoisted(()=>({lookup:vi.fn(),request:vi.fn()}));
vi.mock('node:dns/promises',()=>({lookup:mocks.lookup}));
vi.mock('node:https',async()=>({...await vi.importActual('node:https'),request:mocks.request}));
import { readPublicPage, optionsAllLookup } from './adminMarketingPublicWeb';
afterEach(()=>{vi.resetAllMocks();vi.unstubAllEnvs();});
describe('Marketing network boundary',()=>{
 it('pins both Node auto-family and single-address DNS lookup forms',()=>{const callback=vi.fn(),addresses=[{address:'2606:4700:4700::1111',family:6},{address:'1.1.1.1',family:4}];optionsAllLookup({all:true},addresses,callback);expect(callback).toHaveBeenLastCalledWith(null,addresses);optionsAllLookup({},addresses,callback);expect(callback).toHaveBeenLastCalledWith(null,addresses[0].address,6);});
 it('allows Node to try every validated address when the first network family is unavailable',async()=>{
  vi.stubEnv('HTTPS_PROXY','');vi.stubEnv('https_proxy','');
  const addresses=[{address:'2606:4700:4700::1111',family:6},{address:'1.1.1.1',family:4}];mocks.lookup.mockResolvedValue(addresses);
  mocks.request.mockImplementation((_url,options,respond)=>{
   expect(options).toMatchObject({autoSelectFamily:true,autoSelectFamilyAttemptTimeout:250});
   const resolved=vi.fn();options.agent.options.lookup('firm.example',{all:true},resolved);expect(resolved).toHaveBeenCalledWith(null,addresses);
   const req=Object.assign(new EventEmitter(),{setTimeout:vi.fn(),end:()=>{const response=Object.assign(new PassThrough(),{statusCode:200,headers:{}});respond(response);response.end('Public page');}});return req;
  });
  expect((await readPublicPage('https://firm.example/')).text).toBe('Public page');expect(mocks.lookup).toHaveBeenCalledOnce();
 });
 it('rejects private DNS answers before creating any connection',async()=>{mocks.lookup.mockResolvedValue([{address:'169.254.169.254',family:4}]);await expect(readPublicPage('https://firm.example/')).rejects.toThrow('publică');expect(mocks.request).not.toHaveBeenCalled();});
 it('rejects mixed public/private and IPv4-mapped DNS answers without connection',async()=>{mocks.lookup.mockResolvedValue([{address:'1.1.1.1',family:4},{address:'::ffff:127.0.0.1',family:6}]);await expect(readPublicPage('https://firm.example/')).rejects.toThrow('publică');expect(mocks.request).not.toHaveBeenCalled();});
});
