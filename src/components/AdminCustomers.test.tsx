// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
vi.mock('next-intl',()=>({useMessages:()=>({ui:{}}),useLocale:()=> 'ro'}));
import {AdminCustomers} from './AdminCustomers';
let root:Root,host:HTMLDivElement;
const group=(rows:unknown[]=[],hasMore=false)=>({rows,hasMore});
const record=(offset=0,financial=true)=>({
 user:{id:'test-customer',name:'Client test',email:'test@example.invalid',phone:null,credit_balance:financial?20:null,created_at:'2026-10-31'},
 permissions:{read:true,annotate:true,restrict:false,financial,value:false},properties:2,
 classification:{revision:1,tags:['recurent'],reason:null,actor:null,createdAt:null},restriction:{revision:0,block_bookings:0,block_assessments:0},
 value:{totalJobs:60,completedJobs:55,completedServiceValueBani:null,margin:null},offset,
 jobs:group([{id:`job-${offset}`,city:'Oraș test',status:'completed',created_at:'2026-10-31'}],offset===0),
 assessments:group(),payments:financial?group([{id:'payment',job_id:'job-0',status:'captured',amount_gross:100}]):group(),cases:group(),ratings:group(),
 notes:group([{id:`note-${offset}`,body:`Notă pagina ${offset}`,actor_id:'test-admin',created_at:'2026-10-31'}],offset===0),restrictions:group(),
});
let fetcher:ReturnType<typeof vi.fn>;
beforeEach(()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
 window.history.replaceState(null,'','/admin/clienti');
 host=document.createElement('div');document.body.append(host);root=createRoot(host);
 fetcher=vi.fn(async(input:RequestInfo|URL)=>{const url=new URL(String(input),'https://nitido.invalid');return Response.json(url.searchParams.has('clientId')?record(Number(url.searchParams.get('offset')??0)):{clients:[{id:'test-customer',name:'Client test',email:'test@example.invalid'}],hasMore:false});});
 vi.stubGlobal('fetch',fetcher);
});
afterEach(async()=>{await act(()=>root.unmount());host.remove();vi.unstubAllGlobals();});
async function render(node:React.ReactNode){await act(async()=>{root.render(node);await new Promise(resolve=>setTimeout(resolve,0));});}
async function click(text:string){const button=[...host.querySelectorAll('button')].find(item=>item.textContent?.trim()===text);expect(button,text).toBeTruthy();await act(async()=>{button!.click();await new Promise(resolve=>setTimeout(resolve,0));});}

it('retains the directory search and page when opening a customer record and returning',async()=>{
 window.history.replaceState(null,'','/admin/clienti?q=Client&offset=50');
 await render(<AdminCustomers loadDirectory/>);
 expect(fetcher.mock.calls[0][0]).toContain('q=Client&offset=50');
 await click('Deschide fișa');
 expect(window.location.search).toContain('clientId=test-customer');
 expect(host.querySelector('.admin-customer-heading')?.textContent).toContain('Client test');
 await click('Înapoi la clienți');
 expect(window.location.search).toBe('?q=Client&offset=50');
 expect(host.querySelector('.admin-customers-table')?.textContent).toContain('Client test');
});

it('paginates only the selected history and restores its page after switching tabs',async()=>{
 await render(<AdminCustomers initialClientId="test-customer" loadDirectory/>);
 await click('Rezervări');await click('Istoric următor');
 expect(host.textContent).toContain('job-50');
 await click('Note și istoric');
 expect(host.textContent).toContain('Notă pagina 0');
 expect(host.textContent).not.toContain('Notă pagina 50');
 await click('Istoric următor');
 expect(host.textContent).toContain('Notă pagina 50');
 await click('Rezervări');
 expect(host.textContent).toContain('job-50');
 expect(host.querySelector('a[href="/admin/lucrari?jobId=job-50"]')).toBeTruthy();
 expect(window.location.search).toContain('page_jobs=50');
 expect(window.location.search).toContain('page_notes=50');
});

it('hides financial history for an operator even when a financial tab is requested in the URL',async()=>{
 window.history.replaceState(null,'','/admin/clienti?clientId=test-customer&detail=payments');
 fetcher.mockImplementation(async()=>Response.json(record(0,false)));
 await render(<AdminCustomers initialClientId="test-customer" loadDirectory/>);
 expect([...host.querySelectorAll('button')].some(button=>button.textContent?.trim()==='Plăți')).toBe(false);
 expect(host.textContent).not.toContain('payment');
 expect(host.textContent).not.toContain('Sold credit înregistrat');
 expect(host.querySelector('button[aria-pressed=true]')?.textContent).toBe('Rezumat');
});
