'use client';
import {useEffect,useState} from 'react';

/** Reads only the visible module; hidden tabs never trigger periodic network work. */
export function useAdminWorkspaceResource<T>(url:string|null,automatic=true){
  const [resource,setResource]=useState<{url:string;data:T;checkedAt:string}|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0);
  useEffect(()=>{
    if(!url)return;
    const controller=new AbortController();let running=false;
    async function load(){
      if(running||controller.signal.aborted)return;running=true;setBusy(true);setError('');
      try{const response=await fetch(url!,{cache:'no-store',signal:controller.signal});if(!controller.signal.aborted&&(response.status===401||response.status===403))setResource(null);const data=await response.json();if(!response.ok)throw Error(data.error??'Datele nu au putut fi încărcate.');if(!controller.signal.aborted)setResource({url:url!,data,checkedAt:new Date().toISOString()});}
      catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Datele nu au putut fi actualizate.');}
      finally{running=false;if(!controller.signal.aborted)setBusy(false);}
    }
    const first=setTimeout(()=>void load(),0);
    const timer=automatic?setInterval(()=>{if(!document.hidden)void load();},30000):null;
    return()=>{clearTimeout(first);if(timer)clearInterval(timer);controller.abort();};
  },[url,automatic,revision]);
  return {data:resource?.url===url?resource.data:null,checkedAt:resource?.url===url?resource.checkedAt:null,error,busy,refresh:()=>setRevision(r=>r+1)};
}
