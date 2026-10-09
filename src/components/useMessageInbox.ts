"use client";
import {useEffect,useState} from "react";
export function useMessageInbox(enabled=true){
 const [inbox,setInbox]=useState<{jobId:string;unread:number}[]>([]);
 useEffect(()=>{if(!enabled)return;let active=true;let busy=false;
 const refresh=async()=>{if(busy||document.visibilityState!=="visible")return;busy=true;try{const r=await fetch("/api/workspace/messages",{cache:"no-store"});if(active){if(r.ok){const d=await r.json();if(active)setInbox(d.inbox??[])}else if(r.status===401)setInbox([])}}catch{}finally{busy=false}};
 void refresh();const timer=setInterval(()=>void refresh(),10000);window.addEventListener("focus",refresh);window.addEventListener("nitido-messages-read",refresh);document.addEventListener("visibilitychange",refresh);
 return()=>{active=false;clearInterval(timer);window.removeEventListener("focus",refresh);window.removeEventListener("nitido-messages-read",refresh);document.removeEventListener("visibilitychange",refresh)};
 },[enabled]);return inbox;
}
