'use client';

import {useEffect,useSyncExternalStore,type ReactNode} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {hasStoredBookingContext} from '@/lib/publicBookingDraft';
import {UiText} from './UiText';

function subscribe(onChange:()=>void){
  window.addEventListener('storage',onChange);
  return ()=>window.removeEventListener('storage',onChange);
}
function savedContext(){
  try{return hasStoredBookingContext(window.sessionStorage)}catch{return true}
}
const serverContext=():boolean|null=>null;

/** Read same-tab drafts after hydration, before mounting a form or replacing its route. */
export function BookingEntry({destination,children}:{destination:string;children:ReactNode}){
  const router=useRouter(),saved=useSyncExternalStore(subscribe,savedContext,serverContext);
  useEffect(()=>{if(saved===false)router.replace(destination)},[saved,destination,router]);
  if(saved===true)return <>{children}</>;
  return <div><p role="status"><UiText text="Se încarcă…"/></p>
    <Link href="/rezervare?countryCode=RO"><UiText text="Rezervă în România"/></Link></div>;
}
