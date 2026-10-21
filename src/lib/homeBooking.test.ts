import {it,expect} from 'vitest';
import {homeBookingValues,type OwnedHome} from './homeBooking';
import {calcServicePrice} from './pricing';
const home:OwnedHome={id:'h',name:'Acasă',city:'Iași',street:'Adresă privată',postal_code:'700001',floor:'2',sqm:80,space_type:'apartament',bathroom_count:2,notes:'Animale',sensitive_materials:'Marmură',usual_tasks:'Podele',access_notes:'Cod privat'};
it('keeps configurator overrides on a new home booking and recalculates its price',()=>{const original=structuredClone(home),v=homeBookingValues(home,{sqm:'100',bathroomCount:'3'});expect(v.sqm).toBe(100);expect(v.bathroomCount).toBe(3);expect(calcServicePrice(v.spaceType,v.sqm,0,v.bathroomCount)).not.toBe(calcServicePrice('apartament',80,0,2));expect(home).toEqual(original);expect(v.details).toContain('Marmură');expect(v.details).not.toContain('Cod privat');});
it('recovers invalid overrides and retains zero bathrooms where explicit',()=>{expect(homeBookingValues(home,{sqm:'NaN',spaceType:'invalid',bathroomCount:'0'})).toMatchObject({sqm:80,spaceType:'apartament',bathroomCount:0});});
