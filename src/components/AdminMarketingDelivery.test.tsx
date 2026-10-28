// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {AdminMarketingDelivery} from './AdminMarketingDelivery';
import {formatMarketingDate,type MarketingCampaign} from '@/lib/adminMarketingWorkspaceShared';
vi.mock('./ui',()=>({Card:({children}:{children:React.ReactNode})=><section>{children}</section>}));
const campaign:MarketingCampaign={id:'fixture-campaign',version:1,name:'Campanie exemplu',subject:'Subiect exemplu',body:'Mesaj exemplu',category:'business',county:'CT',variant:'A',city:'',recipientLimit:50,ctaLabel:'Vezi',ctaUrl:'https://nitido.ro',budgetRon:null,state:'ready',updatedAt:'2026-10-26T21:30:00Z'};
let root:Root,host:HTMLDivElement,fetcher:ReturnType<typeof vi.fn>,report:Record<string,unknown>;
beforeEach(()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});host=document.createElement('div');document.body.append(host);root=createRoot(host);
 report={readiness:{enabled:false,providerConfigured:true,webhookConfigured:false},realEmailsSent:0,runs:[{id:'fixture-run',campaignName:campaign.name,mode:'test',createdAt:'2026-12-31T23:30:00Z',scheduledAt:'2027-01-02T10:00:00Z',holdReason:'Capturat în test.',counts:[{status:'captured',count:1}]}]};
 fetcher=vi.fn(async(_url:string,init?:RequestInit)=>Response.json(init?.method==='POST'?{result:{id:'fixture-run',replayed:false}}:report));vi.stubGlobal('fetch',fetcher);
});
afterEach(async()=>{await act(()=>root.unmount());host.remove();vi.unstubAllGlobals();});
async function render(){await act(async()=>{root.render(<AdminMarketingDelivery campaigns={[campaign]}/>);await new Promise(resolve=>setTimeout(resolve,20));});await act(async()=>{await new Promise(resolve=>setTimeout(resolve,20));});}
it('shows Romanian calendar dates without time or a scheduling input and keeps real sending disabled',async()=>{
 await render();expect(host.querySelector('input[type="datetime-local"]')).toBeNull();expect(host.querySelector('input[type="date"]')).toBeNull();
 expect(host.textContent).toContain('Data inițierii: 01/01/2027');expect(host.textContent).not.toContain('23:30');expect(host.textContent).not.toContain('ora României');
 const send=[...host.querySelectorAll('button')].find(b=>b.textContent==='Trimite campania')!;expect(send.disabled).toBe(true);expect(fetcher.mock.calls.filter(([,init])=>init?.method==='POST')).toHaveLength(0);
});
it('creates only an immediate test run after the explicit button and sends no scheduled timestamp',async()=>{
 await render();const test=[...host.querySelectorAll('button')].find(b=>b.textContent==='Testează fără expediere')!;
 await act(()=>test.click());const writes=fetcher.mock.calls.filter(([,init])=>init?.method==='POST');expect(writes).toHaveLength(1);
 const body=JSON.parse(String(writes[0][1]?.body));expect(body).toMatchObject({action:'queue',data:{id:campaign.id,version:1,mode:'test'}});expect(body.data).not.toHaveProperty('scheduledAt');expect(host.textContent).toContain('pornit manual');
});
it('formats day/month/year in Romania and tolerates missing historical dates',()=>{
 expect(formatMarketingDate('2026-10-26T12:45:00Z')).toBe('26/10/2026');expect(formatMarketingDate('2026-12-31T23:30:00Z')).toBe('01/01/2027');expect(formatMarketingDate('')).toBe('—');
});
it('keeps the report during a Bad Gateway and clears the friendly error after a successful refresh',async()=>{
 await render();fetcher.mockResolvedValueOnce(new Response('Bad Gateway',{status:502}));
 const refresh=[...host.querySelectorAll('button')].find(b=>b.textContent==='Actualizează rapoartele')!;
 await act(()=>refresh.click());expect(host.textContent).toContain('Serverul este temporar indisponibil');expect(host.textContent).not.toContain('Unexpected token');expect(host.textContent).not.toContain('Bad Gateway');
 expect(host.textContent).toContain('Capturat în test');await act(()=>refresh.click());expect(host.querySelector('[role=alert]')).toBeNull();
});
it('requests background processing without reporting unsent messages as processed',async()=>{
 await render();fetcher.mockResolvedValueOnce(Response.json({result:{scheduled:true}}));
 await act(()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Procesează următorul lot')!.click());
 expect(host.textContent).toContain('Procesarea în fundal a fost solicitată');
 expect(JSON.parse(String(fetcher.mock.calls.find(([,init])=>init?.method==='POST')![1]?.body))).toEqual({action:'process'});
});
it('shows a provider quota hold and explains historical uncertainty without fabricating a cause',async()=>{
 report={...report,providerHold:{code:'monthly_quota_exceeded',message:'Limita lunară a furnizorului este atinsă.',retryAt:null,failures:0},runs:[{id:'fixture',campaignName:'Synthetic',mode:'live',holdReason:'În pauză',scheduledAt:'2026-10-28',counts:[{status:'unknown',count:2272}],failures:[{code:'legacy_unconfirmed',count:2272}]}]};
 await render();expect(host.textContent).toContain('Limita lunară');expect(host.textContent).toContain('motivul nu a fost înregistrat');expect(host.textContent).toContain('2272');
 expect(fetcher.mock.calls.some(([,init])=>init?.method==='POST')).toBe(false);
});
