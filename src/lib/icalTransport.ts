import {Resolver} from 'node:dns/promises';
import {BlockList,isIP} from 'node:net';
import {request} from 'node:https';
import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {WorkspaceError} from './workspace';

const blocked=new BlockList();
for(const [address,prefix] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.168.0.0',16],['192.88.99.0',24],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',4],['240.0.0.0',4]] as const)blocked.addSubnet(address,prefix,'ipv4');
export function calendarUrl(input:string){
 let url:URL;try{url=new URL(input.trim().replace(/^webcal:/i,'https:'));}catch{throw new WorkspaceError('Introdu linkul HTTPS de export iCal.');}
 if(input.length>4096||url.protocol!=='https:'||url.username||url.password||url.port||url.hash||isIP(url.hostname)||!url.hostname.includes('.')||url.hostname.endsWith('.'))throw new WorkspaceError('Folosește un link iCal HTTPS, fără autentificare în adresă sau port personalizat.');
 return url;
}
// Kept alongside SQLite in the existing persistent /app/data volume; never exposed in API/logs.
function key(create=false){
 const file=path.join(process.cwd(),'data','ical-url.key');
 if(create){try{writeFileSync(file,randomBytes(32),{flag:'wx',mode:0o600});}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;}}
 const value=readFileSync(file);if(value.length!==32)throw new Error('ical_key_invalid');return value;
}
export function sealCalendarUrl(value:string,id:string){
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(true),iv);cipher.setAAD(Buffer.from(id));
 return Buffer.concat([iv,cipher.update(value),cipher.final(),cipher.getAuthTag()]).toString('base64');
}
export function openCalendarUrl(value:string,id:string){
 const raw=Buffer.from(value,'base64'),decipher=createDecipheriv('aes-256-gcm',key(),raw.subarray(0,12));decipher.setAAD(Buffer.from(id));decipher.setAuthTag(raw.subarray(-16));
 return Buffer.concat([decipher.update(raw.subarray(12,-16)),decipher.final()]).toString('utf8');
}
export async function downloadCalendar(value:string):Promise<string>{
 const resolver=new Resolver({timeout:4000,tries:1});
 const signal=AbortSignal.timeout(25000);
 let url=calendarUrl(value);
 for(let hop=0;hop<4;hop++){
  signal.throwIfAborted();
  const addresses=await resolver.resolve4(url.hostname);
  signal.throwIfAborted();
  if(!addresses.length||addresses.some(a=>!isIP(a)||blocked.check(a,'ipv4')))throw new WorkspaceError('Adresa calendarului nu este un server public acceptat.');
  // Pin the checked address. TLS verification and Host remain tied to the original hostname.
  const result=await new Promise<{body?:string;redirect?:string}>((resolve,reject)=>{
   const req=request(url,{method:'GET',agent:false,family:4,signal,lookup:(_hostname,_options,callback)=>callback(null,addresses[0],4),headers:{Accept:'text/calendar','Accept-Encoding':'identity','User-Agent':'NITIDO-iCal/1.0'}},res=>{
    if([301,302,303,307,308].includes(res.statusCode??0)){const redirect=res.headers.location;res.resume();if(!redirect)return reject(new Error('redirect_missing'));resolve({redirect});return;}
    if(res.statusCode!==200){res.resume();reject(new WorkspaceError(res.statusCode===401||res.statusCode===403?'Linkul calendarului nu mai permite accesul. Înlocuiește linkul de export.':'Furnizorul calendarului nu a răspuns cu un export valid.'));return;}
    if(res.headers['content-encoding']&&res.headers['content-encoding']!=='identity'){res.destroy();reject(new WorkspaceError('Exportul comprimat nu este acceptat. Folosește linkul direct iCal.'));return;}
    let size=0;const chunks:Buffer[]=[];
    res.on('data',(chunk:Buffer)=>{size+=chunk.length;if(size>1_000_000){res.destroy(new Error('size_limit'));return;}chunks.push(chunk);});
    res.on('end',()=>resolve({body:Buffer.concat(chunks).toString('utf8')}));res.on('error',reject);res.on('aborted',()=>reject(new Error('download_incomplete')));
   });
   req.on('error',reject);req.end();
  });
  if(result.body!==undefined)return result.body;
  url=calendarUrl(new URL(result.redirect!,url).toString());
 }
 throw new WorkspaceError('Prea multe redirecționări. Folosește linkul direct de export iCal.');
}
