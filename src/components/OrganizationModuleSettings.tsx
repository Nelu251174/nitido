'use client';
import Link from 'next/link';
import {useState} from 'react';
import {ORGANIZATION_MODULES,type OrganizationModules} from '@/lib/organizationModulesShared';
export function OrganizationModuleSettings({id,modules,owner,busy,onSave}:{id:string;modules:OrganizationModules;owner:boolean;busy:boolean;onSave:(value:Record<string,unknown>)=>Promise<unknown>}){
 const [values,setValues]=useState(modules);
 return <section className="v2-card p-5 mb-5" id="module-organizatie"><h2 className="font-bold text-xl">Modulele organizației</h2><p className="text-sm text-muted my-3">Titularul alege modulele folosite de această organizație. Setările nu modifică portofoliul personal sau alte organizații.</p>
 <form onSubmit={async e=>{e.preventDefault();if(!window.confirm('Salvezi modulele? Dezactivarea oprește operațiunile noi din modul. Datele și lucrările existente se păstrează. Sincronizările iCal oprite se reiau explicit după reactivare.'))return;await onSave({action:'modules.save',organizationId:id,revision:modules.revision,business:values.business,host:values.host,ical:values.ical});}}>
 <div className="form-grid">{ORGANIZATION_MODULES.map(m=><label key={m.key} className="host-proposal"><span className="flex items-center gap-3"><input type="checkbox" checked={values[m.key]} disabled={!owner||busy||(m.key==='ical'&&!values.host)} onChange={e=>setValues({...values,[m.key]:e.target.checked,...(m.key==='host'&&!e.target.checked?{ical:false}:{})})}/><b>{m.label}</b></span><span className="block text-sm text-muted mt-3">{m.description}</span><span className="block text-sm mt-2">{modules[m.key]?'Activ':'Dezactivat'}</span></label>)}</div>
 {owner&&<button className="v2-btn v2-btn-primary mt-4" disabled={busy}>Salvează modulele</button>}
 </form>
 <p className="text-sm text-muted my-4">La dezactivare, istoricul rămâne accesibil, iar lucrările confirmate pot fi finalizate din Rezervări. Noile rezervări și solicitări pentru proprietățile modulului sunt oprite. iCal necesită Curățenie între rezervări.</p>
 <div className="workspace-toolbar">{owner&&<Link className="v2-btn v2-btn-secondary" href="/client/rapoarte">Rapoarte și arhivă</Link>}{owner&&modules.business&&<Link className="v2-btn v2-btn-secondary" href={`/client/business?organizationId=${encodeURIComponent(id)}`}>Deschide Birouri și firme</Link>}{owner&&modules.host&&<Link className="v2-btn v2-btn-secondary" href={`/client/host?organizationId=${encodeURIComponent(id)}`}>Deschide Curățenie între rezervări</Link>}<Link className="v2-btn v2-btn-secondary" href="/colaborari">Solicitări și aprobări</Link></div>
 </section>;
}
