"use client";
import {useState} from 'react';
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import {useAdminWorkspaceResource} from './AdminWorkspaceResource';
import {UiElement,UiText} from './UiText';
import {Card,Button} from './ui';
import {FinancialRecoveryStatus,type RecoveryRun,type RecoveryParked} from './FinancialRecoveryStatus';
import {CancellationRecovery} from './CancellationRecovery';
import {PayoutReconciliation} from './PayoutReconciliation';
type Payment={id:string;job_id:string;amount_gross:number;commission_amount:number;amount_net:number;status:string;stripe_fee_amount:number|null;transfer_status:string;payout_status:string;refund_status:string;dispute_status:string};
type Coverage={job_id:string;state:string;required_until_ms:number;capture_before_ms:number|null};
type Authorization={job_id:string;status:string;created_ms:number;stripe_payment_intent_id:string|null};
type Cancellation={job_id:string;status:string;created_at:string};
type Webhook={event_id:string;event_type:string;resource_id:string|null;status:string;attempts:number};
type BankPayoutRow={account_id:string;payout_id:string;amount_minor:number;currency:string;status:string;arrival_date:number;firm_name:string|null};
type Proof={id:string;job_id:string;uploaded_by_firm_id:string;proof_type:'ARRIVAL'|'COMPLETION';status:string;created_at:string;validated_at:string|null;url:string};
type Review={id:string;job_id:string;firm_id:string;stars:number;comment:string|null;moderation_status:string;created_at:string;report_count:number;verified_job:number};
type Overview={payments:Payment[];coverageIssues:Coverage[];authorizationIssues:Authorization[];cancellationIssues:Cancellation[];webhookIssues:Webhook[];bankPayouts:BankPayoutRow[];proofs:Proof[];reviews:Review[];recoveryRuns:RecoveryRun[];recoveryParked:RecoveryParked[]};
const authorizationLabels:Record<string,string>={reconciliation_required:'Reconciliere obligatorie',pending:'Verificare în curs',unknown:'Rezultat neconfirmat',requires_action:'Confirmare necesară de la client',requires_payment_method:'Card necesar',canceled:'Autorizare anulată sau expirată',processing:'Procesare Stripe'};
const payoutLabels:Record<string,string>={paid:'Confirmat de Stripe',failed:'Eșuat',pending:'În așteptare',in_transit:'În curs',canceled:'Anulat'};
const financialStatus:Record<string,string>={authorized:'Sumă autorizată',captured:'Încasată',refunded:'Rambursată',cancelled:'Anulată',canceled:'Anulată',pending:'În așteptare',failed:'Eșuat',blocked:'Blocat',unknown:'Neconfirmat',none:'Neînregistrat',succeeded:'Confirmat',paid:'Confirmat de Stripe',in_transit:'În curs către bancă',processing:'În procesare',needs_response:'Răspuns necesar',under_review:'În analiză',warning_needs_response:'Avertizare: răspuns necesar',warning_under_review:'Avertizare în analiză',won:'Câștigată',lost:'Pierdută'};
function payoutAmount(p:BankPayoutRow){const formatter=new Intl.NumberFormat('ro-RO',{style:'currency',currency:p.currency.toUpperCase()});return formatter.format(p.amount_minor/10**(formatter.resolvedOptions().maximumFractionDigits??2));}
export function AdminWorkspaceOverview({section}:{section:'plati'|'exceptii'|'viramente'|'dovezi'|'recenzii'}){
 const {data,error,busy,refresh}=useAdminWorkspaceResource<Overview>('/api/admin/overview',false),params=useSearchParams(),jobId=params.get('jobId');
 const [actionError,setActionError]=useState('');
 async function moderateReview(id:string,status:'published'|'under_review'|'hidden'){setActionError('');try{const r=await fetch('/api/admin/reviews/'+encodeURIComponent(id)+'/moderate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({status})});const d=await r.json();if(!r.ok)throw Error(d.error??'Modificarea nu a fost confirmată.');refresh();}catch(e){setActionError(e instanceof Error?e.message:'Modificarea nu a fost confirmată.');}}
 const matching=<T extends {job_id:string}>(rows:T[]|undefined)=>(rows??[]).filter(row=>!jobId||row.job_id===jobId);
 const payments=matching(data?.payments).filter(p=>params.get('issues')!=='1'||['failed','blocked'].includes(p.transfer_status)||p.payout_status==='failed'||['failed','pending'].includes(p.refund_status)||['needs_response','under_review','warning_needs_response','warning_under_review'].includes(p.dispute_status)),coverageIssues=matching(data?.coverageIssues),authorizationIssues=matching(data?.authorizationIssues),cancellationIssues=matching(data?.cancellationIssues),proofs=matching(data?.proofs),reviews=matching(data?.reviews);
 const webhookIssues=data?.webhookIssues??[],bankPayouts=data?.bankPayouts??[],recoveryRuns=data?.recoveryRuns??[],recoveryParked=data?.recoveryParked??[];
 return <><div className="workspace-redesign-toolbar"><p><UiText text="Stări confirmate în registrele platformei. Execuția și rezultatele financiare sunt verificate separat."/></p><button type="button" disabled={busy} className="v2-btn v2-btn-secondary" onClick={refresh}><UiText text={busy?'Se actualizează…':'Actualizează'}/></button></div>{jobId&&<div className="workspace-redesign-context"><UiText text="Context lucrare"/>: {jobId}<Link href={'/admin/lucrari?jobId='+encodeURIComponent(jobId)} className="v2-btn v2-btn-secondary"><UiText text="Înapoi la lucrare"/></Link></div>}{error&&<p role="alert"><UiText text={error}/></p>}{actionError&&<p role="alert"><UiText text={actionError}/></p>}{!data&&!error&&<p><UiText text="Se încarcă registrele…"/></p>}{data&&<>
{section==='plati'&&<>        <section id="plati">
          <h2 className="font-display font-bold text-ink mb-3"><UiText text={params.get('issues')==='1'?'Plăți de verificat':'Registrul plăților'}/></h2><p><strong>{payments.length}</strong> <UiText text="înregistrări pentru selecția curentă"/></p>{params.get('issues')==='1'&&<p className="workspace-redesign-context"><UiText text="Sunt afișate numai transferurile blocate sau eșuate, viramentele eșuate, rambursările în așteptare sau eșuate și disputele nesoluționate."/> <Link href="/admin/financiar?tab=plati"><UiText text="Vezi toate plățile"/></Link></p>}{!payments.length&&<p className="workspace-redesign-empty"><UiText text="Nu există plăți pentru această selecție."/></p>}
          <div className="overflow-x-auto">
            <table className="w-full text-xs bg-white border border-line rounded-xl overflow-hidden">
              <thead className="bg-mist text-muted">
                <tr>
                  <th className="text-left px-3 py-2"><UiText text="Lucrare"/></th>
                  <th className="text-left px-3 py-2"><UiText text={"Brut"}/></th>
                  <th className="text-left px-3 py-2"><UiText text={"Comision"}/></th>
                  <th className="text-left px-3 py-2"><UiText text={"Net firmă"}/></th>
                  <th className="text-left px-3 py-2"><UiText text="Stare"/></th>
                  <th className="text-left px-3 py-2"><UiText text={"Taxă Stripe"}/></th>
                  <th className="text-left px-3 py-2"><UiText text={"Transfer"}/></th>
                  <th className="text-left px-3 py-2"><UiText text="Virament"/></th>
                  <th className="text-left px-3 py-2"><UiText text="Rambursare / dispută"/></th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-t border-line">
                    <td className="px-3 py-2"><Link href={'/admin/lucrari?jobId='+encodeURIComponent(p.job_id)+'&detail=plata'}>#{p.job_id.slice(0,12)}</Link></td>
                    <td className="px-3 py-2">{p.amount_gross}<UiText text={" lei"}/></td>
                    <td className="px-3 py-2">{p.commission_amount}<UiText text={" lei"}/></td>
                    <td className="px-3 py-2">{p.amount_net}<UiText text={" lei"}/></td>
                    <td className="px-3 py-2"><UiText text={financialStatus[p.status]??p.status}/></td>
                    <td className="px-3 py-2">{p.stripe_fee_amount == null ? <UiText text={"Necunoscută"}/> : `${(p.stripe_fee_amount/100).toFixed(2)} lei`}</td>
                    <td className="px-3 py-2"><UiText text={financialStatus[p.transfer_status]??p.transfer_status}/></td>
                    <td className="px-3 py-2"><UiText text={financialStatus[p.payout_status]??p.payout_status}/></td>
                    <td className="px-3 py-2"><UiText text={financialStatus[p.refund_status]??p.refund_status}/> / <UiText text={financialStatus[p.dispute_status]??p.dispute_status}/></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
</>}
{section==='exceptii'&&<>        <FinancialRecoveryStatus runs={recoveryRuns} parked={recoveryParked}/>
        <UiElement as="section" aria-label="Anulări de plată neconfirmate">
          <h2 className="font-semibold mb-2"><UiText text={"Anulări de plată neconfirmate"}/></h2>
          <p className="text-sm text-muted mb-3"><UiText text={"Rezervările de mai jos trebuie verificate înainte de închiderea financiară. Anularea lucrării nu confirmă singură eliberarea banilor."}/></p>
          {!cancellationIssues.length?<p className="text-sm text-muted"><UiText text={"Nu sunt cereri restante înregistrate."}/></p>:<div className="overflow-x-auto"><table className="workspace-table"><thead><tr><th><UiText text={"Lucrare"}/></th><th><UiText text={"Stare"}/></th><th><UiText text={"Solicitată la"}/></th><th><UiText text={"Recuperare"}/></th></tr></thead><tbody>{cancellationIssues.map(c=><tr key={c.job_id}><td>{c.job_id}</td><td>{c.status==='pending'?<UiText text={'Autorizare încă neidentificată'}/>:<UiText text={'Necesită reconciliere'}/>}</td><td>{c.created_at}</td><td><CancellationRecovery jobId={c.job_id} onRecovered={async()=>{refresh();}}/></td></tr>)}</tbody></table></div>}
        </UiElement>

        <UiElement as="section" aria-label="Notificări Stripe de verificat">
          <h2 className="font-display font-bold text-ink mb-3"><UiText text={"Notificări Stripe de verificat"}/></h2>
          <p className="text-sm text-muted mb-3"><UiText text={"Erorile pot fi retrimise din Stripe. Resursele neasociate necesită verificarea referinței înainte de retrimitere."}/></p>
          {!webhookIssues.length?<p className="text-sm text-muted"><UiText text={"Nu sunt notificări restante înregistrate."}/></p>:<div className="overflow-x-auto"><table className="workspace-table"><thead><tr><th><UiText text={"Eveniment"}/></th><th><UiText text={"Resursă"}/></th><th><UiText text={"Stare"}/></th><th><UiText text={"Încercări"}/></th></tr></thead><tbody>{webhookIssues.map(e=><tr key={e.event_id}><td className="break-all">{e.event_type}<small>{e.event_id}</small></td><td className="break-all">{e.resource_id??<UiText text={'Neidentificată'}/>}</td><td>{e.status==='failed'?<UiText text={'Sincronizare eșuată'}/>:e.status==='received'?<UiText text={'Procesare neconfirmată'}/>:<UiText text={'Necesită reconciliere'}/>}</td><td>{e.attempts}</td></tr>)}</tbody></table></div>}
        </UiElement>
        <UiElement as="section" aria-label="Autorizări de verificat">
          <h2 className="font-display font-bold text-ink mb-3"><UiText text={"Autorizări de plată de verificat"}/></h2>
          <p className="text-sm text-muted mb-3"><UiText text={"Cererile cu rezultat neclar trebuie reconciliate înainte de o nouă blocare pe card."}/></p>
          {coverageIssues.length>0&&<div className="mb-4 rounded-xl border border-line p-4"><h3 className="font-bold"><UiText text={"Autorizări care nu acoperă intervenția"}/></h3><p className="text-sm text-muted"><UiText text={"Rezervarea nu este confirmată. Se eliberează numai autorizarea nefolosită; o plată asociată unei rezervări necesită reconciliere manuală. Nu se reautorizează automat cardul."}/></p><table className="workspace-table"><thead><tr><th><UiText text={"Lucrare"}/></th><th><UiText text={"Stare"}/></th><th><UiText text={"Expirare HOLD"}/></th><th><UiText text={"Final + buffer"}/></th></tr></thead><tbody>{coverageIssues.map(c=><tr key={c.job_id}><td>{c.job_id}</td><td>{c.state==='released'?<UiText text={'HOLD eliberat'}/>:c.state==='release_pending'?<UiText text={'Eliberare în curs'}/>:<UiText text={'Necesită reconciliere'}/>}</td><td>{c.capture_before_ms?new Date(c.capture_before_ms).toLocaleString('ro-RO',{timeZone:'Europe/Bucharest'}):<UiText text={'Termen neconfirmat'}/>}</td><td>{new Date(c.required_until_ms).toLocaleString('ro-RO',{timeZone:'Europe/Bucharest'})}</td></tr>)}</tbody></table></div>}
          {authorizationIssues.length===0?<p className="text-sm text-muted"><UiText text={"Nu sunt înregistrate solicitări care necesită verificare."}/></p>:<div className="overflow-x-auto"><table className="w-full text-sm bg-white border border-line"><thead className="bg-mist text-muted"><tr><th className="text-left p-3"><UiText text={"Lucrare"}/></th><th className="text-left p-3"><UiText text={"Stare"}/></th><th className="text-left p-3"><UiText text={"Solicitată la"}/></th><th className="text-left p-3"><UiText text={"Referință Stripe"}/></th></tr></thead><tbody>{authorizationIssues.map(a=><tr key={a.job_id} className="border-t border-line"><td className="p-3 break-all">{a.job_id}</td><td className="p-3">{authorizationLabels[a.status]??<UiText text={"Necesită verificare"}/>}</td><td className="p-3">{new Date(a.created_ms).toLocaleString("ro-RO",{timeZone:"Europe/Bucharest"})}</td><td className="p-3 break-all">{a.stripe_payment_intent_id??<UiText text={"Încă neconfirmată"}/>}</td></tr>)}</tbody></table></div>}
        </UiElement>
</>}
{section==='viramente'&&<>        <UiElement as="section" aria-label="Viramente bancare Stripe">
          <h2 className="font-display font-bold text-ink mb-3"><UiText text={"Viramente bancare către firme"}/></h2>
          <p className="text-sm text-muted mb-3"><UiText text={"Un virament poate cumula mai multe lucrări. Asocierea sumelor cu fiecare lucrare necesită reconciliere financiară."}/></p>
          {bankPayouts.length===0?<p className="text-sm text-muted"><UiText text={"Încă nu sunt înregistrate notificări de virament bancar."}/></p>:<div className="overflow-x-auto"><table className="w-full text-sm bg-white border border-line"><thead className="bg-mist text-muted"><tr><th className="text-left p-3"><UiText text={"Firmă"}/></th><th className="text-left p-3"><UiText text={"Sumă"}/></th><th className="text-left p-3"><UiText text={"Stare"}/></th><th className="text-left p-3"><UiText text={"Sosire estimată"}/></th><th className="text-left p-3"><UiText text={"Referință Stripe"}/></th><th className="text-left p-3"><UiText text={"Reconciliere"}/></th></tr></thead><tbody>{bankPayouts.map(p=><tr key={`${p.account_id}:${p.payout_id}`} className="border-t border-line"><td className="p-3">{p.firm_name??<UiText text={"Firmă neidentificată"}/>}</td><td className="p-3 whitespace-nowrap">{payoutAmount(p)}</td><td className="p-3">{payoutLabels[p.status]??<UiText text={"Necesită verificare"}/>}</td><td className="p-3">{new Date(p.arrival_date*1000).toLocaleDateString("ro-RO",{timeZone:"Europe/Bucharest"})}</td><td className="p-3 break-all">{p.payout_id}</td><td className="p-3"><PayoutReconciliation accountId={p.account_id} payoutId={p.payout_id}/></td></tr>)}</tbody></table></div>}
        </UiElement>
</>}
{section==='dovezi'&&<>        <section>
          <h2 className="font-display font-bold text-ink mb-3"><UiText text="Dovezi foto operaționale"/></h2>{!proofs.length&&<p className="workspace-redesign-empty"><UiText text="Nu sunt dovezi foto înregistrate pentru această selecție."/></p>}
          <div className="overflow-x-auto"><table className="w-full text-xs bg-white border border-line rounded-xl overflow-hidden"><thead className="bg-mist text-muted"><tr><th className="text-left px-3 py-2"><UiText text="Lucrare"/></th><th className="text-left px-3 py-2"><UiText text={"Firmă"}/></th><th className="text-left px-3 py-2"><UiText text={"Tip"}/></th><th className="text-left px-3 py-2"><UiText text="Stare"/></th><th className="text-left px-3 py-2"><UiText text={"Încărcată"}/></th><th className="text-left px-3 py-2"><UiText text={"Validată"}/></th><th className="text-left px-3 py-2"><UiText text={"Dovadă"}/></th></tr></thead><tbody>{proofs.map(p=><tr key={p.id} className="border-t border-line"><td className="px-3 py-2"><Link href={'/admin/lucrari?jobId='+encodeURIComponent(p.job_id)+'&detail=plata'}>#{p.job_id.slice(0,12)}</Link></td><td className="px-3 py-2">{p.uploaded_by_firm_id}</td><td className="px-3 py-2">{p.proof_type}</td><td className="px-3 py-2"><UiText text={financialStatus[p.status]??p.status}/></td><td className="px-3 py-2">{p.created_at}</td><td className="px-3 py-2">{p.validated_at ?? "—"}</td><td className="px-3 py-2"><a className="font-bold text-aqua-deep underline" href={p.url} target="_blank" rel="noreferrer"><UiText text={"Vezi fotografia"}/></a></td></tr>)}</tbody></table></div>
        </section>

</>}
{section==='recenzii'&&<>        <section id="calitate"><h2 className="font-display font-bold text-ink mb-3"><UiText text={"Moderare recenzii"}/></h2><div className="space-y-3">{reviews.map(review=><Card key={review.id}><div className="flex flex-wrap justify-between gap-3"><div><b>{review.stars}<UiText text={" / 5 · Lucrare verificată"}/></b><p className="text-xs text-muted"><UiText text={"Job "}/>{review.job_id}<UiText text={" · Firmă "}/>{review.firm_id} · {review.report_count}<UiText text={" raportări"}/></p></div><span className="text-xs font-bold text-aqua-deep">{review.moderation_status}</span></div>{review.comment&&<p className="mt-3 text-sm text-muted">{review.comment}</p>}<div className="mt-3 flex gap-2"><Button variant="outline" onClick={()=>moderateReview(review.id,"published")}><UiText text={"Publică/restaurează"}/></Button><Button variant="outline" onClick={()=>moderateReview(review.id,"under_review")}><UiText text={"Analizează"}/></Button><Button variant="outline" onClick={()=>moderateReview(review.id,"hidden")}><UiText text={"Ascunde"}/></Button></div></Card>)}{reviews.length===0&&<p className="text-sm text-muted"><UiText text={"Nu există recenzii."}/></p>}</div></section>

</>}
</>}</>;
}
