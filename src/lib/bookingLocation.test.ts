import {beforeEach,describe,it,expect,vi} from 'vitest';
const {position,native,available}=vi.hoisted(()=>({position:vi.fn(),native:vi.fn(),available:vi.fn()}));
vi.mock('@capacitor/core',()=>({Capacitor:{isNativePlatform:native,isPluginAvailable:available}}));
vi.mock('@capacitor/geolocation',()=>({Geolocation:{getCurrentPosition:position}}));
import {currentBookingCity,localityFromGpsResponse} from './bookingLocation';
beforeEach(()=>{vi.restoreAllMocks();native.mockReturnValue(false);available.mockReturnValue(true);position.mockReset();});
describe('booking GPS',()=>{
 it('normalizes Bucharest districts and retains a village fallback',()=>{expect(localityFromGpsResponse({countryCode:'RO',city:'Sector 3'})).toBe('București');expect(localityFromGpsResponse({countryCode:'RO',city:'',locality:'Corbu'})).toBe('Corbu');});
 it('does not substitute a foreign place or empty result',()=>{expect(()=>localityFromGpsResponse({countryCode:'ES',city:'Madrid'})).toThrow(/României/);expect(()=>localityFromGpsResponse({countryCode:'RO'})).toThrow();});
 it('never sends a reverse-geocode request after permission denial',async()=>{const fetcher=vi.spyOn(globalThis,'fetch');position.mockRejectedValue(new Error('Permission denied'));await expect(currentBookingCity(new AbortController().signal)).rejects.toThrow();expect(fetcher).not.toHaveBeenCalled();});
 it('does not call the native plugin in an older installed build',async()=>{native.mockReturnValue(true);available.mockReturnValue(false);await expect(currentBookingCity(new AbortController().signal)).rejects.toThrow(/noua versiune/);expect(position).not.toHaveBeenCalled();});
 it('does not submit a location after leaving the form',async()=>{const controller=new AbortController();controller.abort();const fetcher=vi.spyOn(globalThis,'fetch');position.mockResolvedValue({coords:{latitude:44,longitude:28,accuracy:10}});await expect(currentBookingCity(controller.signal)).rejects.toThrow();expect(fetcher).not.toHaveBeenCalled();});
 it('converts only device coordinates and omits credentials',async()=>{position.mockResolvedValue({coords:{latitude:44,longitude:28,accuracy:10}});const fetcher=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify({countryCode:'RO',city:'Constanța'})));expect(await currentBookingCity(new AbortController().signal)).toBe('Constanța');expect(fetcher).toHaveBeenCalledWith(expect.stringContaining('latitude=44&longitude=28'),expect.objectContaining({credentials:'omit',cache:'no-store'}));});
});
