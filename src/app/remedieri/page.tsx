'use client';
import {useLocale} from 'next-intl';
import {UiText} from '@/components/UiText';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useCurrentUser} from '@/lib/useCurrentUser';
import {WorkspaceNav} from '@/components/WorkspaceNav';
import {VisitCare} from '@/components/VisitCare';
import {Logo} from '@/components/ui';
export default function Cases(){
 const locale=useLocale();
const {user,loading}=useCurrentUser();const [jobs,setJobs]=useState<{id:string;city:string;space_type:string;scheduled_at:string|null}[]>([]),[selected,setSelected]=useState(''),[error,setError]=useState('');useEffect(()=>{if(!user)return;let live=true;void fetch('/api/workspace/cases').then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);if(live){setJobs(d.jobs);const id=new URLSearchParams(window.location.search).get('jobId');if(d.jobs.some((j:{id:string})=>j.id===id))setSelected(id!);}}).catch(e=>{if(live)setError(e.message)});return()=>{live=false}},[user]);if(loading)return <p className="p-6"><UiText text={"Se încarcă…"}/></p>;if(!user)return <main className="p-6"><Link href="/login?next=%2Fremedieri"><UiText text={"Intră în cont pentru dosarele tale"}/></Link></main>;return <div className={`operations-layout approved-operations role-${user.role}`}><aside className="operations-sidebar"><Logo href={user.role==='firma'?'/firma':'/client'}/><WorkspaceNav role={user.role}/></aside><main className="operations-main"><h1 className="workspace-title"><UiText text={"Probleme și remedieri"}/></h1>{error&&<p role="alert">{<UiText text={error}/>}</p>}<div className="flex flex-wrap gap-3 my-5">{jobs.map(j=><button className="v2-btn v2-btn-secondary" aria-pressed={selected===j.id} key={j.id} onClick={()=>setSelected(j.id)}>{j.city} · {j.space_type} · {j.scheduled_at?new Date(j.scheduled_at).toLocaleDateString(locale):<UiText text={'Fără dată'}/>}</button>)}</div>{!jobs.length&&<p><UiText text={"Nu există dosare. Deschide lucrarea pentru a raporta o problemă."}/></p>}{selected&&<VisitCare key={selected} jobId={selected}/>}</main></div>}
