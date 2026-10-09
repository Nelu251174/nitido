import {describe,it,expect} from 'vitest';
import {addressFromGoogle,validAddressPosition} from './bookingAddress';
const result=(country='RO',precision='ROOFTOP',postal='010011')=>({geometry:{location_type:precision},address_components:[{long_name:'România',short_name:country,types:['country']},{long_name:'Bucharest',types:['locality']},{long_name:'Strada Exemplu',types:['route']},{long_name:'12',types:['street_number']},{long_name:postal,types:['postal_code']}]});
describe('GPS address candidates',()=>{
 it('extracts a Romanian street address and preserves postal leading zero',()=>expect(addressFromGoogle({status:'OK',results:[result()]})).toEqual({city:'București',street:'Strada Exemplu 12',postalCode:'010011'}));
 it('does not assert an interpolated building number',()=>expect(addressFromGoogle({status:'OK',results:[result('RO','RANGE_INTERPOLATED')]}).street).toBe('Strada Exemplu'));
 it('leaves unavailable postal codes empty',()=>expect(addressFromGoogle({status:'OK',results:[result('RO','ROOFTOP','')]}).postalCode).toBe(''));
 it('rejects foreign results instead of treating them as Romanian',()=>expect(()=>addressFromGoogle({status:'OK',results:[result('ES')]})).toThrow(/România/));
 it('rejects provider refusal and an empty response',()=>{expect(()=>addressFromGoogle({status:'REQUEST_DENIED'})).toThrow();expect(()=>addressFromGoogle(null)).toThrow()});
 it('requires precise numeric device coordinates',()=>{expect(validAddressPosition({latitude:44,longitude:26,accuracy:30})).toBe(true);for(const p of [{latitude:44,longitude:26,accuracy:101},{latitude:'44',longitude:26,accuracy:10},{latitude:91,longitude:26,accuracy:10},{latitude:44,longitude:26,accuracy:-1}])expect(validAddressPosition(p)).toBe(false)});
});
