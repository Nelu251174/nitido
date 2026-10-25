import type {NextRequest} from 'next/server';
import {createHash} from 'node:crypto';
import {marketingEnabled,MarketingError} from './adminMarketing';
import {consumeRateLimit,requestIp} from './security';
export async function marketingPublicRequest(req:NextRequest,action:string){
 if(!marketingEnabled())throw new MarketingError('Indisponibil.',404);
 let origin='';try{origin=new URL(process.env.NEXT_PUBLIC_SITE_URL??'').origin;}catch{}
 const allowed=new Set([origin,...(origin==='https://nitido.ro'?['https://www.nitido.ro']:[])]);
 if(!origin||!allowed.has(req.headers.get('origin')??''))throw new MarketingError('Origine invalidă.',403);
 const ip=createHash('sha256').update(requestIp(req)).digest('hex');
 if(!consumeRateLimit('marketing-public:'+action+':'+ip,6,600000))throw new MarketingError('Prea multe cereri. Încearcă din nou în câteva minute.',429);
 if(!req.headers.get('content-type')?.toLowerCase().startsWith('application/json'))throw new MarketingError('Cerere invalidă.',415);
 const reader=req.body?.getReader();if(!reader)throw new MarketingError('Cerere invalidă.');const chunks:Uint8Array[]=[];let bytes=0;
 while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>4096){await reader.cancel();throw new MarketingError('Cerere prea mare.',413);}chunks.push(value);}
 try{const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!data||typeof data!=='object'||Array.isArray(data))throw Error();return data as Record<string,unknown>;}catch{throw new MarketingError('Verifică datele completate.');}
}
