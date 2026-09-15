'use client';
import {useEffect,useState} from 'react';
/** Snapshot time outside render; refresh open scheduling views every 30 seconds. */
export function useClock(){
 const [now,setNow]=useState(()=>Date.now());
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(timer)},[]);
 return now;
}
