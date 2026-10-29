'use client';
import {useLayoutEffect,useRef} from 'react';

export function isAdminDocumentReload(){
 if(typeof window==='undefined')return false;
 const navigation=window.performance.getEntriesByType?.('navigation')?.[0] as PerformanceNavigationTiming|undefined;
 return navigation?.type==='reload';
}

/** A refresh opens the dashboard top; deliberate navigation keeps its destination. */
export function useAdminReloadScroll(ready:boolean){
 const restore=useRef<(()=>void)|null>(null);
 useLayoutEffect(()=>{
  if(!isAdminDocumentReload())return;
  const previous=window.history.scrollRestoration;
  const revert=()=>{window.history.scrollRestoration=previous;};
  restore.current=revert;
  window.history.scrollRestoration='manual';
  const url=new URL(window.location.href);
  if(url.hash){url.hash='';window.history.replaceState(window.history.state,'',url);}
  window.scrollTo({top:0,left:0,behavior:'instant'});
  return()=>{revert();restore.current=null;};
 },[]);
 useLayoutEffect(()=>{
  if(!ready||!isAdminDocumentReload())return;
  let second=0;
  const first=requestAnimationFrame(()=>{
   window.scrollTo({top:0,left:0,behavior:'instant'});
   // Authentication mounts the dashboard after the initial document load.
   second=requestAnimationFrame(()=>restore.current?.());
  });
  return()=>{cancelAnimationFrame(first);cancelAnimationFrame(second);};
 },[ready]);
}
