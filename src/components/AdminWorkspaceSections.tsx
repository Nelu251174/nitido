'use client';
import {useState} from 'react';
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import {hasAdminPermission,type AdminIdentity} from '@/lib/adminRolesShared';
import {AdminWorkspaceTabs} from './AdminWorkspaceShell';
import {AdminWorkspaceJobs} from './AdminWorkspaceJobs';
import {AdminWorkspaceOverview} from './AdminWorkspaceOverview';
import {AdminCustomers} from './AdminCustomers';
import {AdminOwnerNotifications} from './AdminOwnerNotifications';
import {AdminAccountDeletion} from './AdminAccountDeletion';
import {AdminIncidentReviews} from './AdminIncidentReviews';
import {AdminIncidentTriage} from './AdminIncidentTriage';
import {AdminNotificationBell} from './AdminNotificationBell';
import {AdminOperationalReport} from './AdminOperationalReport';
import {AdminProviderScore} from './AdminProviderScore';
import {AdminStaff} from './AdminStaff';
import {AdminServiceCatalog} from './AdminServiceCatalog';
import {AdminExecutionTemplates} from './AdminExecutionTemplates';
import {AdminPricing} from './AdminPricing';
import {AdminMarginPolicy} from './AdminMarginPolicy';
import {AdminJobCosts} from './AdminJobCosts';
import {UiElement,UiText} from './UiText';
import {useAdminWorkspaceResource} from './AdminWorkspaceResource';

export function AdminWorkspaceClients({identity}:{identity:AdminIdentity}){
 const params=useSearchParams(),requested=params.get('tab'),tab=requested==='inscrieri'&&identity.role==='super_admin'?'inscrieri':requested==='conturi'&&hasAdminPermission(identity.role,'operations')?'conturi':'clienti';
 return <><AdminWorkspaceTabs active={tab} items={[{key:'clienti',label:'Clienți',href:'/admin/clienti'},...(identity.role==='super_admin'?[{key:'inscrieri',label:'Înregistrări și descărcări',href:'/admin/clienti?tab=inscrieri'}]:[]),...(hasAdminPermission(identity.role,'operations')?[{key:'conturi',label:'Cereri privind conturile',href:'/admin/clienti?tab=conturi'}]:[])]}/>{tab==='clienti'?<AdminCustomers key={params.get('clientId')??'directory'} initialClientId={params.get('clientId')??undefined} loadDirectory/>:tab==='inscrieri'?<AdminOwnerNotifications/>:<AdminAccountDeletion/>}</>;
}

export function AdminWorkspaceSupport({identity}:{identity:AdminIdentity}){
 const params=useSearchParams(),can=(p:Parameters<typeof hasAdminPermission>[1])=>hasAdminPermission(identity.role,p),superAdmin=identity.role==='super_admin';
 const available=[...(superAdmin?['incidente','recenzii','dovezi','notificari']:['incidente']),...(can('operations')?['termene']:[])];
 const requested=params.get('tab')??'incidente',tab=available.includes(requested)?requested:'incidente',jobId=params.get('jobId')??undefined;
 if(requested==='notificari'&&!superAdmin)return <section className="workspace-redesign-panel"><h2><UiText text="Notificări de verificat"/></h2><p role="status"><UiText text="Situația agregată este disponibilă în pagina Azi. Istoricul detaliat și verificarea livrării notificărilor necesită rolul Super Admin."/></p><p><UiText text="Solicită verificarea unui administrator cu acest rol; accesul tău nu a fost modificat."/></p><Link className="v2-btn v2-btn-secondary" href="/admin/suport?tab=incidente"><UiText text="Înapoi la incidente"/></Link></section>;
 return <><AdminWorkspaceTabs active={tab} items={[{key:'incidente',label:'Incidente și remedieri',href:'/admin/suport?tab=incidente'},...(can('operations')?[{key:'termene',label:'Termene și alerte interne',href:'/admin/suport?tab=termene'}]:[]),...(superAdmin?[{key:'recenzii',label:'Recenzii',href:'/admin/suport?tab=recenzii'},{key:'dovezi',label:'Dovezi foto',href:'/admin/suport?tab=dovezi'},{key:'notificari',label:'Notificări',href:'/admin/suport?tab=notificari'}]:[])]}/>{jobId&&<div className="workspace-redesign-context"><UiText text="Context lucrare"/>: {jobId}<Link href={(can('operations')?'/admin/lucrari?jobId=':'/admin/financiar?tab=lucrari&jobId=')+encodeURIComponent(jobId)} className="v2-btn v2-btn-secondary"><UiText text="Înapoi la lucrare"/></Link></div>}{tab==='incidente'?<AdminIncidentReviews key={(jobId??'all')+':'+(params.get('caseId')??'all')+':'+(params.get('offset')??'0')} canManage={can('manage')} canReview={can('operations')} canFinance={can('finance')} jobId={jobId} initialCaseId={params.get('caseId')??undefined} initialDetail={params.get('detail')??undefined} initialOffset={Number(params.get('offset')??0)}/>:tab==='termene'?<AdminIncidentTriage canManage={can('manage')} onSaved={async()=>{}}/>:tab==='notificari'?<AdminNotificationBell full/>:<AdminWorkspaceOverview section={tab==='dovezi'?'dovezi':'recenzii'}/>}</>;
}

export function AdminWorkspaceFinance({identity}:{identity:AdminIdentity}){
 const params=useSearchParams(),superAdmin=identity.role==='super_admin',requested=params.get('tab')??'lucrari';
 const available=superAdmin?['lucrari','plati','exceptii','viramente','costuri']:['lucrari','costuri'],tab=available.includes(requested)?requested:'lucrari';
 const [offerId,setOfferId]=useState(params.get('offerId')??'');
 return <><AdminWorkspaceTabs active={tab} items={[{key:'lucrari',label:'Financiar pe lucrare',href:'/admin/financiar?tab=lucrari'},...(superAdmin?[{key:'plati',label:'Registru plăți',href:'/admin/financiar?tab=plati'},{key:'exceptii',label:'Excepții și reconciliere',href:'/admin/financiar?tab=exceptii'},{key:'viramente',label:'Viramente bancare',href:'/admin/financiar?tab=viramente'}]:[]),{key:'costuri',label:'Costuri efective',href:'/admin/financiar?tab=costuri'}]}/>{tab==='lucrari'?<AdminWorkspaceJobs identity={identity} financialOnly/>:tab==='costuri'?<section className="workspace-redesign-panel"><h2><UiText text="Costuri efective pe ofertă asistată"/></h2><p><UiText text="Raportul de costuri nu modifică plata clientului sau viramentul către firmă."/></p><p><Link className="v2-btn v2-btn-secondary" href="/admin/costuri-internationale">Costuri internaționale — calcule în pregătire</Link></p><label><UiText text="Identificator ofertă asistată"/><UiElement as="input" value={offerId} maxLength={100} onChange={e=>setOfferId(e.target.value)} placeholder="Identificatorul ofertei"/></label>{offerId&&<AdminJobCosts key={offerId} offerId={offerId}/>}<p><UiText text="Rambursările se verifică în rezoluția incidentului asociat lucrării."/></p><Link href="/admin/suport"><UiText text="Deschide incidentele"/></Link></section>:<AdminWorkspaceOverview section={tab as 'plati'|'exceptii'|'viramente'}/>}</>;
}

export function AdminWorkspaceReports({identity}:{identity:AdminIdentity}){
 const params=useSearchParams(),tab=params.get('tab')==='prestatori'?'prestatori':'operational';
 return <><AdminWorkspaceTabs active={tab} items={[{key:'operational',label:'Performanță operațională',href:'/admin/rapoarte'},{key:'prestatori',label:'Calitatea prestatorilor',href:'/admin/rapoarte?tab=prestatori'},{key:'rezervari',label:'Progresul rezervărilor',href:'/admin/raport-rezervari'},{key:'retentie',label:'Revenire clienți',href:'/admin/rapoarte?tab=retentie'}]}/>{tab==='prestatori'?<AdminProviderScore canManage={hasAdminPermission(identity.role,'manage')}/>:<AdminOperationalReport/>}</>;
}

export function AdminWorkspaceSettings({identity}:{identity:AdminIdentity}){
 const params=useSearchParams(),superAdmin=identity.role==='super_admin',available=superAdmin?['servicii','tarife','executie','echipa','estimator']:['servicii','tarife','executie'];
 const requested=params.get('tab')??'servicii',tab=available.includes(requested)?requested:'servicii';
 return <><AdminWorkspaceTabs active={tab} items={[{key:'servicii',label:'Catalog servicii',href:'/admin/setari'},{key:'tarife',label:'Tarife și marjă',href:'/admin/setari?tab=tarife'},{key:'executie',label:'Proceduri de execuție',href:'/admin/setari?tab=executie'},...(superAdmin?[{key:'echipa',label:'Echipă și acces',href:'/admin/setari?tab=echipa'},{key:'estimator',label:'Calculator public',href:'/admin/setari?tab=estimator'}]:[])]}/>{tab==='servicii'?<AdminServiceCatalog/>:tab==='tarife'?<><AdminPricing/><AdminMarginPolicy/></>:tab==='executie'?<AdminExecutionTemplates/>:tab==='echipa'?<AdminStaff/>:<AdminWorkspaceEstimator/>}</>;
}

function AdminWorkspaceEstimator(){
 const {data,error,busy,refresh}=useAdminWorkspaceResource<{options:{key:string;label:string;enabled:boolean}[]}>('/api/admin/estimator',false),[labels,setLabels]=useState<Record<string,string>>({}),[message,setMessage]=useState(''),[saving,setSaving]=useState(false);
 async function save(key:string,patch:{label?:string;enabled?:boolean}){if(saving)return;setSaving(true);setMessage('');try{const r=await fetch('/api/admin/estimator',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key,...patch})}),d=await r.json();if(!r.ok)throw Error(d.error??'Salvarea nu a fost confirmată.');refresh();setMessage('Opțiunea a fost salvată.');}catch(e){setMessage(e instanceof Error?e.message:'Salvarea nu a fost confirmată.');}finally{setSaving(false);}}
 return <section className="workspace-redesign-panel"><h2><UiText text="Tipurile afișate în calculatorul public"/></h2><p><UiText text="Etichetele și vizibilitatea pot fi schimbate aici. Prețul rămâne calculat din tariful oficial."/></p>{error&&<p role="alert"><UiText text={error}/></p>}{message&&<p role="status"><UiText text={message}/></p>}{data?.options.map(option=><form key={option.key} className="workspace-redesign-toolbar" onSubmit={e=>{e.preventDefault();void save(option.key,{label:labels[option.key]??option.label});}}><label>{option.key}<input value={labels[option.key]??option.label} onChange={e=>setLabels(current=>({...current,[option.key]:e.target.value}))}/></label><button className="v2-btn v2-btn-primary" disabled={busy||saving}><UiText text="Salvează"/></button><button type="button" className="v2-btn v2-btn-secondary" disabled={busy||saving} onClick={()=>void save(option.key,{enabled:!option.enabled})}><UiText text={option.enabled?'Ascunde':'Afișează'}/></button><span><UiText text={option.enabled?'Vizibil':'Ascuns'}/></span></form>)}</section>;
}
