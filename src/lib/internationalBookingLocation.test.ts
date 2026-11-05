import {describe,it,expect} from 'vitest';
import markets from '@/data/internationalMarketScope.json';
import {internationalLocationCity,internationalAddressFromGoogle,internationalLocalityFromResponse} from './internationalBookingLocation';
const result=(country='FR',city='Paris',precision='ROOFTOP',postal='75001')=>({geometry:{location_type:precision},address_components:[{short_name:country,types:['country']},{long_name:city,types:['locality']},{long_name:'Rue Exemple',types:['route']},{long_name:'12',types:['street_number']},{long_name:postal,types:['postal_code']}]});
describe('international GPS address boundary',()=>{
 it('matches all 78 configured localities without expanding commercial coverage',()=>{for(const m of markets)for(const city of m.cities)expect(internationalLocationCity(m.countryCode,city)).toEqual({countryCode:m.countryCode,city});});
 it.each([['AT','Vienna','Wien'],['BE','Brussels','Bruxelles'],['BG','Sofia','София'],['CY','Lefkosia','Nicosia'],['CZ','Prague','Praha'],['DK','Copenhagen','København'],['DE','Munich','München'],['GR','Athens','Αθήνα'],['IT','Rome','Roma'],['NL','The Hague','Den Haag'],['PL','Warsaw','Warszawa'],['PT','Lisbon','Lisboa'],['SE','Gothenburg','Göteborg']])('maps exact country-scoped exonym %s/%s', (country,alias,city)=>expect(internationalLocationCity(country,alias)).toEqual({countryCode:country,city}));
 it('does not treat suburbs, districts or foreign same-name cities as a supported capital',()=>{for(const [country,city] of [['FR','Paris 15e'],['FR','Versailles'],['US','Paris'],['RO','București'],['ES','Paris'],['FR','']])expect(()=>internationalLocationCity(country,city)).toThrow();});
 it('extracts a precise street and preserves international postal leading zero/letters',()=>{expect(internationalAddressFromGoogle({status:'OK',results:[result('IE','Dublin','ROOFTOP','D02 X285')]})).toEqual({countryCode:'IE',city:'Dublin',street:'Rue Exemple 12',postalCode:'D02 X285'});expect(internationalAddressFromGoogle({status:'OK',results:[result('FR','Paris','ROOFTOP','01000')]}).postalCode).toBe('01000');});
 it('never invents an interpolated house number or malformed postal code',()=>expect(internationalAddressFromGoogle({status:'OK',results:[result('FR','Paris','RANGE_INTERPOLATED','<script>')]})).toEqual({countryCode:'FR',city:'Paris',street:'Rue Exemple',postalCode:''}));
 it('requires a country/locality/road from the same result and never substitutes administrative regions',()=>{
  const r=result();r.address_components=r.address_components.filter(c=>!c.types.includes('locality'));r.address_components.push({long_name:'Paris',types:['administrative_area_level_1']});
  expect(()=>internationalAddressFromGoogle({status:'OK',results:[r]})).toThrow();expect(()=>internationalAddressFromGoogle({status:'OK',results:[result('US','Paris')]})).toThrow();
 });
 it('rejects provider errors and incomplete/malformed results',()=>{for(const data of [null,{status:'REQUEST_DENIED'}, {status:'OK',results:[]},{status:'OK',results:[null]}])expect(()=>internationalAddressFromGoogle(data)).toThrow();});
 it('returns only the supported locality when the address service is not configured',()=>expect(internationalLocalityFromResponse({countryCode:'it',city:'Rome',latitude:99,longitude:123})).toEqual({countryCode:'IT',city:'Roma',street:'',postalCode:''}));
});
