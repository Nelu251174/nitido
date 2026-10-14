
import {UiDate} from '@/components/UiDate';
import {UiText,UiElement} from '@/components/UiText';
export interface RecoveryRun {status:string;started_ms:number;completed_ms:number|null;attempted:number;processed:number;deferred:number;failed:number}
export interface RecoveryParked {kind:string;resource_id:string;attempts:number;last_error:string|null}
const labels:Record<string,string>={running:'În curs',completed:'Rulare încheiată',failed:'Rulare neconfirmată',abandoned:'Rulare întreruptă',unconfirmed:'Confirmare lipsă după întrerupere'};
export function FinancialRecoveryStatus({runs,parked}:{runs:RecoveryRun[];parked:RecoveryParked[]}){
 return <UiElement as="section" aria-label="Recuperare financiară periodică">
   <h2 className="font-display font-bold text-ink mb-3"><UiText text={"Recuperare financiară periodică — sandbox"}/></h2>
   <p className="text-sm text-muted mb-3"><UiText text={"O rulare încheiată poate lăsa cazuri nereconciliate. Verifică rezultatele și restanțele înainte de închiderea financiară."}/></p>
   {!runs.length?<p className="text-sm text-muted"><UiText text={"Nu există rulări înregistrate. Activarea și programarea trebuie verificate în mediul de test."}/></p>:<div className="overflow-x-auto"><table className="workspace-table"><thead><tr><th><UiText text={"Început"}/></th><th><UiText text={"Stare"}/></th><th><UiText text={"Încercate"}/></th><th><UiText text={"Rezolvate"}/></th><th><UiText text={"Amânate"}/></th><th><UiText text={"Erori"}/></th></tr></thead><tbody>{runs.map((r,index)=><tr key={`${r.started_ms}-${index}`}><td>{<UiDate value={new Date(r.started_ms)} kind="dateTime" options={{timeZone:'Europe/Bucharest'}}/>}</td><td>{labels[r.status]??<UiText text={'Necesită verificare'}/>}</td><td>{r.attempted}</td><td>{r.processed}</td><td>{r.deferred}</td><td>{r.failed}</td></tr>)}</tbody></table></div>}
   {!!parked.length&&<div className="mt-3"><h3 className="font-semibold"><UiText text={"Cazuri care cer intervenție"}/></h3><p className="text-sm text-muted"><UiText text={"Limita reîncercărilor automate a fost atinsă. Verifică referințele; notificările pot fi retrimise din Stripe, iar anulările pot fi reluate din secțiunea de mai jos."}/></p><ul className="list-disc pl-5">{parked.map(item=><li key={`${item.kind}:${item.resource_id}`} className="break-all">{item.kind==='event'?<UiText text={'Notificare'}/>:<UiText text={'Anulare'}/>} {item.resource_id} — {item.attempts}<UiText text={" încercări"}/></li>)}</ul></div>}
 </UiElement>;
}
