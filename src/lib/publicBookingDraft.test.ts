import {describe,it,expect,vi,afterEach} from 'vitest';
import {cleanBookingDraft,mergePublicBookingDraft,readBookingDraft,saveBookingDraft} from './publicBookingDraft';
afterEach(()=>vi.unstubAllGlobals());
describe('public booking session handoff',()=>{
 it('whitelists only configurator selections, never restores address, prices or payment state',()=>{expect(cleanBookingDraft({city:'Iași',sqm:'80',street:'private',price:'1',card:'secret',mode:'express'})).toEqual({city:'Iași',sqm:'80',mode:'express'});});
 it('uses explicit navigation selections, then recovers later edits on same-route reload',()=>{const defaults={sqm:'80'},saved={sqm:'90',city:'Iași'},initial={sqm:'80'};expect(mergePublicBookingDraft(defaults,saved,initial,false).sqm).toBe('80');expect(mergePublicBookingDraft(defaults,saved,initial,true)).toEqual(saved);});
 it('keeps dates and extras on a homepage-to-configurator handoff without resetting them',()=>{expect(mergePublicBookingDraft({city:'',sqm:'80'},{date:'2026-11-12',scheduled:'true',bathroomCount:'2',windowsSqm:'10'},{city:'București',sqm:'80'},false)).toMatchObject({sqm:'80',date:'2026-11-12',bathroomCount:'2',city:'București'});});
 it('survives unavailable or corrupted storage and rejects oversized values',()=>{vi.stubGlobal('sessionStorage',{getItem:()=>'{invalid',setItem:()=>{throw Error('disabled')}});expect(readBookingDraft()).toEqual({});expect(()=>saveBookingDraft({sqm:'80'})).not.toThrow();expect(cleanBookingDraft({city:'x'.repeat(101),sqm:80})).toEqual({});});
});
