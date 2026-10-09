import type { NextRequest } from 'next/server';
import {hasTrustedMutationOrigin} from './security';
import {AccountDeletionError} from './accountDeletion';
/** Must follow getCurrentUser(req): a supplied bearer never substitutes validation. */
export function deletionMutationOrigin(req: NextRequest) {
 const mobile=process.env.NITIDO_ENABLE_BEARER_AUTH==='true'&&/^Bearer \S+$/.test(req.headers.get('authorization')??'');
 return (mobile||!!req.headers.get('origin'))&&hasTrustedMutationOrigin(req);
}
export async function readDeletionBody(req: NextRequest, maxBytes=2048) {
 const declared=req.headers.get('content-length');
 if(declared&&(!/^\d+$/.test(declared)||Number(declared)>maxBytes)) throw new AccountDeletionError('Cerere prea mare.',413);
 const reader=req.body?.getReader(); if(!reader) throw new AccountDeletionError('Confirmare obligatorie.');
 const chunks:Uint8Array[]=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();throw new AccountDeletionError('Cerere prea mare.',413);}chunks.push(value);}}finally{reader.releaseLock();}
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));}catch{throw new AccountDeletionError('Date invalide.');}
}
