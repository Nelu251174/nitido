import {it,expect} from 'vitest';
import {propertyDraft,propertyPayload} from './propertyForm';
const p={id:'p',name:'Birou',city:'București',street:'Strada 1',sqm:90,space_type:'birou',kind:'business',cost_center:'IT',budget_bani:12345,notes:'Acces după 9'};
it('preserves existing identity and fields while editing',()=>{const draft=propertyDraft(p);expect(draft.budget).toBe('123.45');const result=propertyPayload({...draft,name:'Birou nou'});expect(result).toMatchObject({...p,name:'Birou nou',action:'property.save'})});
it('converts comma decimal budgets to exact bani',()=>{expect(propertyPayload({...propertyDraft(p),budget:'150,25'}).budget_bani).toBe(15025)});
it('rejects invalid surface and budget instead of rounding them silently',()=>{for(const sqm of ['','0','1001','1.5','NaN'])expect(()=>propertyPayload({...propertyDraft(p),sqm})).toThrow();for(const budget of ['','-1','1e3','1.234','1000001'])expect(()=>propertyPayload({...propertyDraft(p),budget})).toThrow()});
it('omits identity for new properties and validates text bounds',()=>{const result=propertyPayload(propertyDraft({...p,id:undefined}));expect(result).not.toHaveProperty('id');expect(()=>propertyPayload({...propertyDraft(p),name:' '})).toThrow();expect(()=>propertyPayload({...propertyDraft(p),notes:'x'.repeat(2001)})).toThrow()});
