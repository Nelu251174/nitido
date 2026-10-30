// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {AdminOwnerNotifications} from './AdminOwnerNotifications';
let root:Root,container:HTMLDivElement;
beforeEach(()=>{vi.useFakeTimers();Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});container=document.createElement('div');document.body.append(container);root=createRoot(container);});
afterEach(async()=>{await act(()=>root.unmount());container.remove();vi.useRealTimers();vi.unstubAllGlobals();});
it('shows all three account categories beside each registration and separates email delivery status',async()=>{
 const rows=[['CLIENT_REGISTERED','Client privat'],['CLIENT_REGISTERED','Client comercial (firmă)'],['FIRM_REGISTERED','Firmă de curățenie']];
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({unread:3,config:{enabled:true,emailConfigured:true,recipient:'nelutofan@gmail.com'},reports:[],events:rows.map(([event_type,accountType],i)=>({id:'fixture'+i,event_type,accountType,city:i===0?null:i===1?'Constanța':'Iași',citySource:i===0?null:i===1?'saved_properties':'firm_coverage',name:'Cont test '+i,email:'fixture'+i+'@example.test',created_ms:Date.now(),read_ms:null,email_status:'sent',payload:{connectionCountry:'RO'}}))})));
 await act(()=>root.render(<AdminOwnerNotifications/>));await act(()=>vi.advanceTimersByTimeAsync(0));
 expect(container.textContent).toContain('Email: nelutofan@gmail.com');expect([...container.querySelectorAll('th')].map(e=>e.textContent)).toEqual(['Data · ora','Nume / eveniment','Email','Tip cont','Oraș','Țară','Stare email','Acțiuni']);
 const displayed=[...container.querySelectorAll('tbody tr')];expect(displayed).toHaveLength(3);
 for(const [i,row] of displayed.entries()){expect(row.children[3].textContent).toBe(rows[i][1]);expect(row.children[4].textContent).toBe(['Nespecificat','Constanța','Iași'][i]);expect(row.children[5].textContent).toBe('RO');expect(row.textContent).toContain('Acceptat');expect(row.children[6].querySelector('[title]')?.getAttribute('title')).toContain('primirea în căsuța destinatarului nu este confirmată');expect(row.querySelector('a[aria-label]')?.getAttribute('href')).toBe(i===2?'/admin#firme':'/admin#clienti');}
 expect(displayed[1].children[4].getAttribute('title')).toContain('nu confirmă domiciliul sau sediul');
 expect(displayed[2].children[4].getAttribute('title')).toContain('acoperire');
});
