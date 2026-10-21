"use client";
import {useEffect,useState} from 'react';
import {readBookingDraft,saveBookingDraft,cleanBookingDraft,mergePublicBookingDraft} from '@/lib/publicBookingDraft';
export function useBookingDraft(initial: Record<string,string>, defaults: Record<string,string>) {
 const [draft,setDraft]=useState({...defaults,...cleanBookingDraft(initial)});
 const [ready,setReady]=useState(false);
 useEffect(()=>{
  const saved=readBookingDraft();
  const source=JSON.stringify(cleanBookingDraft(initial));
  let sameSource=false;
  try {sameSource=sessionStorage.getItem('nitido.booking-source.v1')===source;if(Object.keys(initial).length)sessionStorage.setItem('nitido.booking-source.v1',source);} catch { /* Optional storage. */ }
  const restored=mergePublicBookingDraft(defaults,saved,initial,sameSource);
  // Synchronize the current tab's external session storage after hydration.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  setDraft(restored);setReady(true);
 // Initialize once for this route; subsequent changes belong to the user.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);
 function update(patch: Record<string,string>) {
  setDraft(current=>{const next={...current,...patch};saveBookingDraft(next);return next;});
 }
 return {draft,update,ready};
}
