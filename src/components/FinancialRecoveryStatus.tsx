export interface RecoveryRun {status:string;started_ms:number;completed_ms:number|null;attempted:number;processed:number;deferred:number;failed:number}
export interface RecoveryParked {kind:string;resource_id:string;attempts:number;last_error:string|null}
const labels:Record<string,string>={running:'În curs',completed:'Rulare încheiată',failed:'Rulare neconfirmată',abandoned:'Rulare întreruptă',unconfirmed:'Confirmare lipsă după întrerupere'};
export function FinancialRecoveryStatus({runs,parked}:{runs:RecoveryRun[];parked:RecoveryParked[]}){
 return <section aria-label="Recuperare financiară periodică">
   <h2 className="font-display font-bold text-ink mb-3">Recuperare financiară periodică — sandbox</h2>
   <p className="text-sm text-muted mb-3">O rulare încheiată poate lăsa cazuri nereconciliate. Verifică rezultatele și restanțele înainte de închiderea financiară.</p>
   {!runs.length?<p className="text-sm text-muted">Nu există rulări înregistrate. Activarea și programarea trebuie verificate în mediul de test.</p>:<div className="overflow-x-auto"><table className="workspace-table"><thead><tr><th>Început</th><th>Stare</th><th>Încercate</th><th>Rezolvate</th><th>Amânate</th><th>Erori</th></tr></thead><tbody>{runs.map((r,index)=><tr key={`${r.started_ms}-${index}`}><td>{new Date(r.started_ms).toLocaleString('ro-RO',{timeZone:'Europe/Bucharest'})}</td><td>{labels[r.status]??'Necesită verificare'}</td><td>{r.attempted}</td><td>{r.processed}</td><td>{r.deferred}</td><td>{r.failed}</td></tr>)}</tbody></table></div>}
   {!!parked.length&&<div className="mt-3"><h3 className="font-semibold">Cazuri care cer intervenție</h3><p className="text-sm text-muted">Limita reîncercărilor automate a fost atinsă. Verifică referințele; notificările pot fi retrimise din Stripe, iar anulările pot fi reluate din secțiunea de mai jos.</p><ul className="list-disc pl-5">{parked.map(item=><li key={`${item.kind}:${item.resource_id}`} className="break-all">{item.kind==='event'?'Notificare':'Anulare'} {item.resource_id} — {item.attempts} încercări</li>)}</ul></div>}
 </section>;
}
