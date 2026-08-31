import type {ApiErrorShape} from "./types";
import {ApiError} from "./apiCore";
import {getSessionToken,setSessionToken} from "./sessionStore";
export {ApiError,normalizeApiError} from "./apiCore";
export const API_BASE_URL=(process.env.EXPO_PUBLIC_NITIDO_API_BASE_URL??"").replace(/\/$/,"");
export {getSessionToken,setSessionToken};
export async function api<T>(path:string,init:RequestInit={}):Promise<T>{if(!API_BASE_URL)throw new ApiError("Configurează EXPO_PUBLIC_NITIDO_API_BASE_URL.",0,"CONFIG");const token=await getSessionToken();const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),15000);try{const response=await fetch(`${API_BASE_URL}${path}`,{...init,credentials:"include",signal:controller.signal,headers:{Accept:"application/json",...(init.body instanceof FormData?{}:{"Content-Type":"application/json"}),...(token?{Authorization:`Bearer ${token}`}:{ }),...init.headers}});const body=await response.json().catch(()=>({})) as T&ApiErrorShape;if(!response.ok)throw new ApiError(body.error??"Cererea NITIDO a eșuat.",response.status,body.code);return body}finally{clearTimeout(timer)}}
