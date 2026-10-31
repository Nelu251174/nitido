// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {useAdminWorkspaceResource} from './AdminWorkspaceResource';
import {AdminWorkspaceJobs} from './AdminWorkspaceJobs';
import {AdminWorkspaceDashboard,adminWorkspaceLegacyTarget} from './AdminWorkspaceDashboard';
import {AdminIncidentReviews} from './AdminIncidentReviews';

const navigation=vi.hoisted(()=>({query:'',push:vi.fn()}));
vi.mock('next/navigation',()=>({useSearchParams:()=>new URLSearchParams(navigation.query),useRouter:()=>({push:navigation.push})}));
vi.mock('next/link',()=>({default:({children,...props}:React.ComponentProps<'a'>)=>React.createElement('a',props,children)}));
vi.mock('./UiText',()=>({UiText:({text}:{text:React.ReactNode})=>text,UiElement:({as,...props}:{as:React.ElementType})=>React.createElement(as,props)}));
vi.mock('./AdminAssessments',()=>({AdminAssessments:()=>React.createElement('div',null,'Assessment module')}));
vi.mock('./BoardSidebar',()=>({BoardSidebar:()=>null}));
vi.mock('./AdminNotificationBell',()=>({AdminNotificationBell:()=>null}));
vi.mock('./AdminIncidentTriage',()=>({AdminIncidentTriage:()=>React.createElement('div',null,'Triage controls')}));
vi.mock('./AdminIncidentResolution',()=>({AdminIncidentResolution:()=>React.createElement('div',null,'Financial resolution controls')}));

let root:Root,container:HTMLDivElement;
beforeEach(()=>{vi.useFakeTimers();Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});navigation.query='';navigation.push.mockClear();window.history.replaceState(null,'','/admin');container=document.createElement('div');document.body.append(container);root=createRoot(container);});
afterEach(async()=>{await act(()=>root.unmount());container.remove();vi.useRealTimers();vi.unstubAllGlobals();});
async function mount(element:React.ReactNode){await act(()=>root.render(element));await act(()=>vi.advanceTimersByTimeAsync(0));}
function Resource({url='/private'}:{url?:string}){const {data,error}=useAdminWorkspaceResource<{secret:string}>(url);return <div><b>{data?.secret}</b><span>{error}</span></div>;}

describe('private workspace data lifecycle',()=>{
 it.each([401,403])('removes previously displayed private data after access is refused (%i)',async status=>{
  const fetcher=vi.fn().mockResolvedValueOnce(Response.json({secret:'Synthetic private record'})).mockResolvedValueOnce(new Response('Access refused',{status}));vi.stubGlobal('fetch',fetcher);
  await mount(<Resource/>);expect(container.textContent).toContain('Synthetic private record');
  await act(()=>vi.advanceTimersByTimeAsync(30000));expect(container.textContent).not.toContain('Synthetic private record');expect(container.querySelector('span')?.textContent).not.toBe('');
 });
 it('keeps the last same-module result after a network failure and stops refreshing hidden tabs',async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce(Response.json({secret:'Last confirmed result'})).mockRejectedValueOnce(Error('Network unavailable'));vi.stubGlobal('fetch',fetcher);await mount(<Resource/>);
  await act(()=>vi.advanceTimersByTimeAsync(30000));expect(container.textContent).toContain('Last confirmed result');expect(container.textContent).toContain('Network unavailable');
  Object.defineProperty(document,'hidden',{configurable:true,value:true});await act(()=>vi.advanceTimersByTimeAsync(60000));expect(fetcher).toHaveBeenCalledTimes(2);Object.defineProperty(document,'hidden',{configurable:true,value:false});
 });
 it('never displays the old module while the next module is still loading',async()=>{
  let finish:(value:Response)=>void=()=>{};vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(Response.json({secret:'Old dossier'})).mockImplementationOnce(()=>new Promise<Response>(resolve=>{finish=resolve;})));
  await mount(<Resource url="/first"/>);expect(container.textContent).toContain('Old dossier');await act(()=>root.render(<Resource url="/second"/>));expect(container.textContent).not.toContain('Old dossier');await act(()=>vi.advanceTimersByTimeAsync(0));await act(()=>finish(Response.json({secret:'New dossier'})));expect(container.textContent).toContain('New dossier');
 });
});

it('loads only dashboard data and links scheduled-day counts to the Bucharest date',async()=>{
 const fetcher=vi.fn<(url:unknown)=>Promise<Response>>(async()=>Response.json({checkedAt:'2026-10-31T12:00:00Z',date:'2026-10-31',timezone:'Europe/Bucharest',counts:{urgent:0,attention:0,scheduledToday:3,financialIssues:2},attention:{items:[],total:0,limits:'Fixture scope'},schedule:{jobs:[],total:3,limit:20}}));vi.stubGlobal('fetch',fetcher);await mount(<AdminWorkspaceDashboard/>);
 expect(fetcher.mock.calls.map(c=>c[0])).toEqual(['/api/admin/dashboard']);expect(container.querySelector('a[href="/admin/lucrari?date=2026-10-31&scheduled=1"]')?.textContent).toContain('3');expect(container.querySelector('a[href="/admin/financiar?tab=plati&issues=1"]')).toBeTruthy();expect(container.textContent).not.toContain('Assessment module');
});

it('preserves list filters in dossier links and hides financial values from an operator',async()=>{
 navigation.query='q=Synthetic&status=accepted&date=2026-10-31&jobId=job_test&detail=plata';
 const job={id:'job_test',city:'Fixture City',client_id:'client_test',client_name:'Synthetic Client',firm_name:'Synthetic Firm',status:'accepted',scheduled_at:'2026-10-31T15:00:00Z',accepted_firm_id:'firm_test',payments:[{id:'p',status:'captured',amount_gross:98765,refund_status:'none',stripe_payment_intent_id:'pi_fixture',stripe_refund_id:null}]};
 const fetcher=vi.fn<(url:unknown)=>Promise<Response>>(async()=>Response.json({jobs:[job],hasMore:false,total:1,financial:false}));vi.stubGlobal('fetch',fetcher);await mount(<AdminWorkspaceJobs identity={{id:'operator_test',email:'operator@example.invalid',role:'operator',revision:1}}/>);
 const dossier=Array.from(container.querySelectorAll('a')).find(a=>a.textContent==='Deschide');expect(dossier?.getAttribute('href')).toContain('q=Synthetic');expect(dossier?.getAttribute('href')).toContain('status=accepted');expect(dossier?.getAttribute('href')).toContain('date=2026-10-31');expect(dossier?.getAttribute('href')).toContain('jobId=job_test');
 expect(container.querySelector('a[href="/admin/clienti?clientId=client_test"]')).toBeTruthy();expect(container.textContent).not.toContain('98765');expect(container.textContent).not.toContain('pi_fixture');expect(fetcher.mock.calls.some(c=>String(c[0]).includes('jobId=job_test'))).toBe(true);
});

it('keeps legacy bookmarks contextual without accepting an unrelated hash as a module',()=>{
 expect(adminWorkspaceLegacyTarget('#operatiuni','job_test')).toBe('/admin/lucrari?jobId=job_test');expect(adminWorkspaceLegacyTarget('#calitate','job_test')).toBe('/admin/suport?tab=recenzii&jobId=job_test');expect(adminWorkspaceLegacyTarget('#inscrieri',null)).toBe('/admin/clienti?tab=inscrieri');expect(adminWorkspaceLegacyTarget('#unrelated',null)).toBeNull();
});

it('keeps a contextual incident on its summary until verification or resolution is explicitly opened',async()=>{
 window.history.replaceState(null,'','/admin/suport?tab=incidente&jobId=job_test&caseId=case_test');
 const fetcher=vi.fn<(url:unknown)=>Promise<Response>>(async()=>Response.json({cases:[{id:'case_test',job_id:'job_test',category:'quality',description:'Synthetic case description',photo_id:null,status:'open',updated_at:'2026-10-31T10:00:00Z',reviews:[],events:[]}],hasMore:false}));vi.stubGlobal('fetch',fetcher);
 await mount(<AdminIncidentReviews jobId="job_test" initialCaseId="case_test"/>);
 expect(String(fetcher.mock.calls[0][0])).toContain('jobId=job_test');expect(String(fetcher.mock.calls[0][0])).toContain('caseId=case_test');expect(container.textContent).toContain('Synthetic case description');expect(container.textContent).not.toContain('Financial resolution controls');expect(container.textContent).not.toContain('Triage controls');
 const tab=(label:string)=>Array.from(container.querySelectorAll<HTMLButtonElement>('nav button')).find(button=>button.textContent===label)!;
 await act(()=>tab('Verificare').click());expect(container.textContent).toContain('Triage controls');expect(container.textContent).not.toContain('Financial resolution controls');expect(new URLSearchParams(window.location.search).get('jobId')).toBe('job_test');expect(new URLSearchParams(window.location.search).get('detail')).toBe('verificare');
 await act(()=>tab('Rezoluție').click());expect(container.textContent).toContain('Financial resolution controls');expect(fetcher).toHaveBeenCalledTimes(1);
});
