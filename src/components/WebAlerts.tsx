'use client';
import {useEffect,useRef,useState} from 'react';
import {usePathname} from 'next/navigation';
import type {WebAlert} from '@/lib/webAlerts';
import {alertHref,freshAlerts} from '@/lib/webAlertState';
type Feed={userId:string;role:'client'|'firma';events:WebAlert[]};
export function WebAlerts(){
 const path=usePathname();
 if(!/^\/(client|firma)(\/|$)/.test(path))return null;
 return <WebAlertsSession key={path.split('/')[1]}/>;
}
function WebAlertsSession(){
 const [account,setAccount]=useState<Feed|null>(null),[toast,setToast]=useState<{title:string;href:string;count:number}|null>(null),[enabled,setEnabled]=useState(false),[hint,setHint]=useState('');
 const sound=useRef<AudioContext|null>(null),lastSound=useRef(0),soundEnabled=useRef(false);
 function chime(force=false){const ctx=sound.current;if(!ctx||ctx.state!=='running'||(!force&&Date.now()-lastSound.current<3000))return;lastSound.current=Date.now();
  for(const offset of [0,.42]){const oscillator=ctx.createOscillator(),gain=ctx.createGain();oscillator.connect(gain);gain.connect(ctx.destination);const at=ctx.currentTime+offset;oscillator.frequency.setValueAtTime(740,at);oscillator.frequency.setValueAtTime(980,at+.16);gain.gain.setValueAtTime(.001,at);gain.gain.linearRampToValueAtTime(.28,at+.02);gain.gain.exponentialRampToValueAtTime(.001,at+.36);oscillator.start(at);oscillator.stop(at+.38);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};}
 }
 async function testSound(){try{sound.current??=new AudioContext();await sound.current.resume();if(sound.current.state!=='running')throw Error();chime(true);setHint('Sunet de test redat. Dacă nu îl auzi, verifică volumul calculatorului și dacă fila este dezactivată audio.');}catch{setHint('Sunetul este blocat de browser. Permite redarea audio pentru NITIDO și reîncearcă.');}}

 useEffect(()=>{
  let alive=true,busy=false,owner='';const memory=new Map<string,string[]>();const controller=new AbortController();const native:Notification[]=[];
  const refresh=async()=>{if(busy)return;busy=true;try{
   const r=await fetch('/api/workspace/alerts',{cache:'no-store',signal:controller.signal});if(!alive)return;
   if(r.status===401){owner='';setAccount(null);setToast(null);native.forEach(n=>n.close());return;}if(!r.ok)return;
   const feed:Feed=await r.json();if(!alive)return;
   if(owner!==feed.userId){owner=feed.userId;setToast(null);native.forEach(n=>n.close());}
   setAccount(feed);
   const key=`nitido.web-alerts.${feed.userId}`;let on=false;try{on=localStorage.getItem(key+'.sound')==='on';}catch{}soundEnabled.current=on;setEnabled(on);
   const claim=()=>{if(!alive)return;let seen=memory.get(key)??null;try{const stored=localStorage.getItem(key);if(stored){const parsed=JSON.parse(stored);if(Array.isArray(parsed)&&parsed.every(x=>typeof x==='string'))seen=parsed;}}catch{}
    const result=freshAlerts(feed.events,seen);memory.set(key,result.seen);try{localStorage.setItem(key,JSON.stringify(result.seen));}catch{}
    if(!result.fresh.length)return;
    const event=result.fresh[0],title=event.kind==='message'?'Ai primit un mesaj nou':'Lucrarea ta a fost finalizată',href=alertHref(feed.role,event);
    setToast({title,href,count:result.fresh.length});if(on){if(sound.current?.state==='running')chime();else setHint("Popup primit, dar sunetul nu este activ în această filă. Apasă Testează sunetul.");}
    if(on&&document.visibilityState!=='visible'&&'Notification' in window&&Notification.permission==='granted'){try{const n=new Notification(title,{body:'Deschide NITIDO pentru detalii.',tag:'nitido-activity',silent:Boolean(sound.current?.state==='running')});native.push(n);n.onclick=()=>{window.focus();window.location.assign(href);n.close();};}catch{}}
   };
   if(navigator.locks)await navigator.locks.request(key,claim);else claim();
  }catch{}finally{busy=false;}};
  const unlock=()=>{if(!soundEnabled.current)return;try{sound.current??=new AudioContext();if(sound.current.state==='suspended')void sound.current.resume().catch(()=>undefined);}catch{}};
  void refresh();const timer=setInterval(()=>void refresh(),10000);window.addEventListener('focus',refresh);document.addEventListener('pointerdown',unlock);
  return()=>{alive=false;controller.abort();clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('pointerdown',unlock);native.forEach(n=>n.close());};
 },[]);
 useEffect(()=>()=>{void sound.current?.close();},[]);
 async function enable(){if(!account)return;const next=!enabled;soundEnabled.current=next;setEnabled(next);try{localStorage.setItem(`nitido.web-alerts.${account.userId}.sound`,next?'on':'off');}catch{}
  if(!next){setHint('Sunetul și alertele desktop sunt oprite.');return;}
  // Both permission requests begin in the user's click handler.
  let permission:Promise<NotificationPermission>|undefined;
  if('Notification' in window&&Notification.permission==='default')permission=Notification.requestPermission().catch(()=>'denied' as NotificationPermission);
  try{sound.current??=new AudioContext();await sound.current.resume();chime();}catch{setHint('Browserul nu a permis sunetul. Popupurile din pagină rămân active.');return;}
  const granted=permission?await permission:('Notification' in window?Notification.permission:'denied');
  setHint(granted==='granted'?'Alerte active cât timp NITIDO este deschis în browser.':'Sunet activ în pagină. Notificările desktop nu sunt permise în acest browser.');
 }
 if(!account)return null;
 return <aside className="web-alerts" aria-label="Alerte NITIDO"><button className="web-alert-toggle" onClick={()=>void enable()}>{enabled?'Oprește sunetul și alertele desktop':'Activează sunetul și alertele desktop'}</button><button className="web-alert-toggle" onClick={()=>void testSound()}>Testează sunetul</button>{hint&&<p className="web-alert-hint" role="status">{hint}<button aria-label="Închide explicația" onClick={()=>setHint('')}>×</button></p>}{toast&&<div className="web-alert-toast" role="status"><button aria-label="Închide alerta" onClick={()=>setToast(null)}>×</button><strong>{toast.title}</strong>{toast.count>1&&<p>{toast.count} noutăți în cont.</p>}<a href={toast.href}>Vezi detaliile</a></div>}</aside>;
}
