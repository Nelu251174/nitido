'use client';
import {useState} from 'react';
import {SUPPORT_TOPICS} from '@/lib/supportKnowledge';
export function SupportQuestions(){
 const [query,setQuery]=useState(''),[audience,setAudience]=useState('all');
 const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const topics=SUPPORT_TOPICS.filter(t=>(audience==='all'||t.audience==='all'||t.audience===audience)&&normalize(t.title+' '+t.aliases.join(' ')).includes(normalize(query)));
 return <section className="mt-8"><h3 className="font-bold">Întrebări și răspunsuri · {SUPPORT_TOPICS.length}</h3><p className="text-sm text-muted mt-2">Ghidul platformei este disponibil și când asistentul AI nu este activ.</p><label className="block mt-4 text-sm">Caută un subiect<input className="w-full border border-line rounded-xl p-3 mt-2" placeholder="Fotografii, plată, cont, rezervare…" value={query} onChange={e=>setQuery(e.target.value)}/></label><label className="block mt-3 text-sm">Pentru cine?<select className="w-full border border-line rounded-xl p-3 mt-2" value={audience} onChange={e=>setAudience(e.target.value)}><option value="all">Toate întrebările</option><option value="client">Clienți</option><option value="firma">Firme de curățenie</option></select></label><div className="mt-4 max-h-[440px] overflow-y-auto">{topics.map(t=><details key={t.id} className="border-b border-line py-3"><summary className="cursor-pointer font-semibold text-sm">{t.title}</summary><p className="text-sm leading-6 whitespace-pre-wrap mt-3">{t.answer}</p></details>)}{!topics.length&&<p className="text-sm py-4">Niciun rezultat. Încearcă alt termen sau contactează suportul.</p>}</div></section>;
}
