import {describe,expect,it,vi} from 'vitest';
import {ApiError} from './apiCore';
import {restoreAuthenticatedSession} from './authSessionCore';
describe('native authenticated restoration',()=>{
 it('clears the native token when the API returns 200 with no user',async()=>{const clear=vi.fn();expect(await restoreAuthenticatedSession(vi.fn().mockResolvedValue({user:null}),clear)).toBeNull();expect(clear).toHaveBeenCalledOnce()});
 it('clears an expired 401 bearer without interpreting it as network failure',async()=>{const clear=vi.fn();expect(await restoreAuthenticatedSession(vi.fn().mockRejectedValue(new ApiError('Expired',401)),clear)).toBeNull();expect(clear).toHaveBeenCalledOnce()});
 it('preserves a stored token during a temporary connection failure',async()=>{const clear=vi.fn();await expect(restoreAuthenticatedSession(vi.fn().mockRejectedValue(new Error('Offline')),clear)).rejects.toThrow('Offline');expect(clear).not.toHaveBeenCalled()});
 it('accepts only backend-confirmed supported identity and does not route unknown roles into the firm shell',async()=>{const clear=vi.fn(),user={id:'u1',role:'client',name:'Client',email:'c@example.test'};expect(await restoreAuthenticatedSession(vi.fn().mockResolvedValue({user}),clear)).toEqual(user);expect(clear).not.toHaveBeenCalled();await expect(restoreAuthenticatedSession(vi.fn().mockResolvedValue({user:{...user,role:'admin'}}),clear)).rejects.toThrow('rol');expect(clear).toHaveBeenCalledOnce()});
});
