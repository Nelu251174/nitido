// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const route=vi.hoisted(()=>({pathname:'/client'}));
vi.mock('next/navigation',()=>({usePathname:()=>route.pathname}));
vi.mock('./useMessageInbox',()=>({useMessageInbox:()=>[]}));
vi.mock('./OperationalInbox',()=>({OperationalInbox:()=>null}));
vi.mock('@/components/UiText',()=>({UiText:({text}:{text:string})=><>{text}</>,UiElement:({as:Tag='div',children,...props}:React.PropsWithChildren<Record<string,unknown>>)=>React.createElement(Tag as string,props,children)}));
import {WorkspaceNav} from './WorkspaceNav';
import {ClientMobileNavigation} from './ClientMobileNavigation';
import type {AdminRole} from '@/lib/adminRolesShared';
let root:Root,container:HTMLDivElement;
beforeEach(()=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  route.pathname='/client';window.history.replaceState(null,'','/client');
  container=document.createElement('div');document.body.append(container);root=createRoot(container);
});
afterEach(async()=>{await act(()=>root.unmount());container.remove();});
async function render(node:React.ReactNode){await act(()=>root.render(node));}
function primaryHrefs(){return [...container.querySelectorAll<HTMLAnchorElement>('.workspace-nav-primary a')].map(a=>a.getAttribute('href'));}
function admin(role:AdminRole){return <WorkspaceNav role="admin" adminIdentity={{id:'test',email:'admin@example.test',role,revision:1}}/>;}

describe('workspace navigation redesign',()=>{
  it('keeps six main client destinations and places optional tools outside the main menu',async()=>{
    await render(<WorkspaceNav/>);
    expect(primaryHrefs()).toEqual(['/client','/client/rezervari','/client/proprietati','/client/mesaje','/client/plati','/client/cont']);
    expect(container.querySelector('.workspace-nav-primary')?.textContent).not.toContain('NEW');
    for(const href of ['/client/planul-casei','/client/rutina','/client/firme-preferate','/client/evaluari','/dosare','/remedieri','/client/organizatii','/client/host','/colaborari','/echipa']){
      const link=container.querySelector(`a[href="${href}"]`);
      expect(link,href).not.toBeNull();
      expect(link?.closest('details.workspace-nav-secondary'),href).not.toBeNull();
    }
    expect(container.querySelector('a[href="/client#sec-form"]')).not.toBeNull();
  });
  it('marks only payments active on its page, rather than also marking home',async()=>{
    route.pathname='/client/plati';await render(<WorkspaceNav/>);
    const selected=[...container.querySelectorAll('a[aria-current="page"]')];
    expect(selected.map(a=>a.getAttribute('href'))).toEqual(['/client/plati']);
  });
  it('recognizes old payment links and preserves the narrow mobile bar with real route links',async()=>{
    window.history.replaceState(null,'','/client#sec-plata');
    await render(<><WorkspaceNav/><ClientMobileNavigation/></>);
    expect(container.querySelector('.workspace-nav a[aria-current="page"]')?.getAttribute('href')).toBe('/client/plati');
    expect(container.querySelector('.client-mobile-navigation a[aria-current="page"]')).toBeNull();
    expect([...container.querySelectorAll<HTMLAnchorElement>('.client-mobile-navigation a')].map(a=>a.getAttribute('href'))).toEqual(['/client','/client/rezervari','/client/mesaje','/client/cont']);
  });
  it('opens the mobile menu for keyboard use and restores focus when Escape closes it',async()=>{
    await render(<WorkspaceNav/>);
    const toggle=container.querySelector<HTMLButtonElement>('button.workspace-menu-toggle')!;
    await act(()=>toggle.click());
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(container.querySelector('nav a'));
    await act(()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'})));
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(toggle);
  });
  it('shows eight main admin modules and settings only to the authorized owner',async()=>{
    await render(admin('super_admin'));
    expect(primaryHrefs()).toEqual(['/admin','/admin/lucrari','/admin/clienti','/admin/firme','/admin/suport','/admin/financiar','/admin/marketing','/admin/rapoarte']);
    expect(container.querySelector('a[href="/admin/setari"]')).not.toBeNull();
    expect(container.querySelector('a[href="/dosare"]')).toBeNull();
    expect(container.querySelector('a[href="/"]')?.getAttribute('target')).toBe('_blank');
  });
  it.each([
    ['operator',['/admin','/admin/lucrari','/admin/clienti','/admin/suport']],
    ['manager',['/admin','/admin/lucrari','/admin/clienti','/admin/firme','/admin/suport','/admin/rapoarte']],
    ['finance',['/admin/clienti','/admin/suport','/admin/financiar','/admin/rapoarte']],
  ] as const)('keeps the %s admin menu aligned with server permissions',async(role,expected)=>{
    await render(admin(role));expect(primaryHrefs()).toEqual(expected);
    expect(container.querySelector('a[href="/admin/marketing"]')).toBeNull();
    expect(Boolean(container.querySelector('a[href="/admin/setari"]'))).toBe(role==='manager');
  });
});
