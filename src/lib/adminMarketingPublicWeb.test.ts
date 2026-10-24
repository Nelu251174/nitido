import { afterEach, describe, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({lookup:vi.fn(),request:vi.fn()}));
vi.mock('node:dns/promises',()=>({lookup:mocks.lookup}));
vi.mock('node:https',async()=>({...await vi.importActual('node:https'),request:mocks.request}));
import { readPublicPage, optionsAllLookup } from './adminMarketingPublicWeb';
afterEach(()=>vi.resetAllMocks());
describe('Marketing network boundary',()=>{
 it('pins both Node auto-family and single-address DNS lookup forms',()=>{const callback=vi.fn(),address={address:'1.1.1.1',family:4};optionsAllLookup({all:true},address,callback);expect(callback).toHaveBeenLastCalledWith(null,[address]);optionsAllLookup({},address,callback);expect(callback).toHaveBeenLastCalledWith(null,'1.1.1.1',4);});
 it('rejects private DNS answers before creating any connection',async()=>{mocks.lookup.mockResolvedValue([{address:'169.254.169.254',family:4}]);await expect(readPublicPage('https://firm.example/')).rejects.toThrow('publică');expect(mocks.request).not.toHaveBeenCalled();});
 it('rejects mixed public/private and IPv4-mapped DNS answers without connection',async()=>{mocks.lookup.mockResolvedValue([{address:'1.1.1.1',family:4},{address:'::ffff:127.0.0.1',family:6}]);await expect(readPublicPage('https://firm.example/')).rejects.toThrow('publică');expect(mocks.request).not.toHaveBeenCalled();});
});
