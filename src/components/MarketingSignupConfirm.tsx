'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {UiText} from '@/components/UiText';
import {readMarketingResponse} from '@/lib/adminMarketingResponse';
export function MarketingSignupConfirm(){const token=useRef('');const [busy,setBusy]=useState(false),[done,setDone]=useState(false),[error,setError]=useState('');useEffect(()=>{token.current=window.location.hash.slice(1);history.replaceState(null,'',window.location.pathname);},[]);
 return <main className="max-w-xl mx-auto p-8 space-y-5"><Link href="/" className="font-bold text-2xl"><UiText text={"NITIDO"}/></Link><h1 className="text-3xl font-bold"><UiText text="Confirmă înscrierea pentru noutăți NITIDO"/></h1>{done?<p role="status"><UiText text="Confirmarea a fost înregistrată. Preferințele existente de dezabonare rămân respectate."/></p>:<><p><UiText text="Confirmă că dorești comunicările NITIDO la adresa asociată acestui link."/></p>{error&&<p role="alert">{error}</p>}<button className="v2-btn v2-btn-primary" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await readMarketingResponse(await fetch('/api/marketing/confirm',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:token.current})}));setDone(true);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>{busy?<UiText text="Se confirmă…"/>:<UiText text="Confirmă înscrierea"/>}</button></>}</main>;
}
