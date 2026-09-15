'use client';
import {useEffect,useState} from 'react';
export function JobNavigation({jobId,address}:{jobId:string;address?:string}){
 const [link,setLink]=useState<{url:string;hasPin:boolean;jobId:string}|null>(null);
 useEffect(()=>{const controller=new AbortController();fetch(`/api/jobs/${encodeURIComponent(jobId)}/navigation`,{cache:'no-store',signal:controller.signal}).then(async r=>{if(r.ok){const d=await r.json();if(!controller.signal.aborted)setLink({...d,jobId});}}).catch(()=>{});return()=>controller.abort();},[jobId]);
 if(!link||link.jobId!==jobId)return address?<p>{address}</p>:null;
 return <div className="my-2">{address&&<a className="block font-semibold underline mb-2" href={link.url} target="_blank" rel="noopener noreferrer">{address}</a>}<a className="board-soft-button" href={link.url} target="_blank" rel="noopener noreferrer">📍 Navighează</a><p className="text-xs text-muted mt-1">{link.hasPin?'Traseu către intrarea confirmată de client.':'Traseu după adresă; intrarea nu este marcată.'}</p></div>;
}
