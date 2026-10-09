import {normalizeApiError} from './apiCore';
import type {SessionUser} from './types';
type Requester=<T>(path:string,init?:RequestInit)=>Promise<T>;
export async function restoreAuthenticatedSession(request:Requester,clear:()=>Promise<void>){
 try{
  const result=await request<{user:SessionUser|null}>('/api/auth/me');
  if(!result.user){await clear();return null;}
  if(!result.user.id||!['client','firma'].includes(result.user.role)){await clear();throw new Error('Acest cont nu are un rol disponibil în aplicația mobilă.');}
  return result.user;
 }catch(error){if(normalizeApiError(error).status===401){await clear();return null;}throw error;}
}
