// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const router=vi.hoisted(()=>({replace:vi.fn()}));
vi.mock('next/navigation',()=>({useRouter:()=>router}));
vi.mock('next/link',()=>({default:({children,...props}:React.ComponentProps<'a'>)=><a {...props}>{children}</a>}));
vi.mock('./UiText',()=>({UiText:({text}:{text:string})=><>{text}</>}));
import {BookingEntry} from './BookingEntry';
import {BOOKING_DRAFT_KEY,hasStoredBookingContext} from '@/lib/publicBookingDraft';
let root:Root,el:HTMLDivElement;
beforeEach(()=>{Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});sessionStorage.clear();router.replace.mockReset();el=document.createElement('div');document.body.append(el);root=createRoot(el)});
afterEach(async()=>{await act(()=>root.unmount());el.remove();sessionStorage.clear();vi.restoreAllMocks()});
async function render(){await act(()=>root.render(<BookingEntry destination="/international/booking?countryCode=FR"><p>Existing Romanian draft</p></BookingEntry>))}
it('resumes a same-tab Romanian draft before applying a foreign IP suggestion',async()=>{
 sessionStorage.setItem(BOOKING_DRAFT_KEY,JSON.stringify({city:'Constanța',sqm:'60'}));await render();
 expect(el.textContent).toContain('Existing Romanian draft');expect(router.replace).not.toHaveBeenCalled();
 expect(JSON.parse(sessionStorage.getItem(BOOKING_DRAFT_KEY)!)).toEqual({city:'Constanța',sqm:'60'});
});
it('does not inspect or discard a private payment draft to redirect the visitor',async()=>{
 sessionStorage.setItem('nitido:card-booking-draft:v1','opaque-existing-draft');await render();
 expect(el.textContent).toContain('Existing Romanian draft');expect(router.replace).not.toHaveBeenCalled();
 expect(sessionStorage.getItem('nitido:card-booking-draft:v1')).toBe('opaque-existing-draft');
});
it('routes a genuinely fresh entry only after hydration without mounting the Romanian form',async()=>{
 await render();expect(router.replace).toHaveBeenCalledWith('/international/booking?countryCode=FR');
 expect(el.textContent).not.toContain('Existing Romanian draft');
 expect(el.querySelector('a')?.getAttribute('href')).toBe('/rezervare?countryCode=RO');
});
it('preserves the domestic path when storage cannot establish whether a draft exists',()=>{
 expect(hasStoredBookingContext({getItem:()=>{throw Error('storage disabled')}})).toBe(true);
 sessionStorage.setItem(BOOKING_DRAFT_KEY,'invalid-json');expect(hasStoredBookingContext(sessionStorage)).toBe(true);
});
