'use client';
import {UiMoney} from '@/components/UiMoney';
import {UiText} from '@/components/UiText';
import {WINDOWS_RATE_LEI,WINDOWS_MAX_SQM,validWindowsSqm} from '@/lib/pricing';
export function WindowsExtra({value,onChange,id}:{id?:string;value:number;onChange:(n:number)=>void}){
 return <fieldset className="design-panel my-4"><legend className="font-bold"><UiText text={"Spălare geamuri · serviciu separat"}/></legend><label className="block"><UiText text={"Suprafața geamurilor, m²"}/><input id={id} className="block w-full rounded-lg border p-3 mt-2" type="number" min={0} max={WINDOWS_MAX_SQM} step={1} inputMode="numeric" value={value===0||!Number.isFinite(value)?'':value} onChange={e=>onChange(e.target.value===''?0:Number(e.target.value))}/></label><p className="text-sm mt-2"><UiMoney ron={WINDOWS_RATE_LEI}/><UiText text={"/m². Măsoară lățime × înălțime pentru fiecare geam, o singură dată, și rotunjește totalul în sus. Ambele fețe accesibile și ramele sunt incluse în acest extra."}/></p><p className="text-sm mt-2"><UiText text={"0 m² = fără spălare de geamuri. Geamurile la înălțime, inaccesibile sau cu resturi de constructor necesită evaluare."}/></p>{!validWindowsSqm(value)&&<p role="alert"><UiText text={"Introdu un număr întreg între 0 și "}/>{<UiText text={WINDOWS_MAX_SQM}/>}<UiText text={" m²."}/></p>}</fieldset>;
}
