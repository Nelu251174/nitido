import {expect,it} from 'vitest';
import {bookingEntryRedirect,foreignBookingCountry,internationalInitialCountry,internationalBookingHref} from './bookingEntry';

it('keeps every existing entry unchanged while international pricing is disabled',()=>{
  for(const country of ['RO','FR','ES','US',null]) {
    expect(bookingEntryRedirect({},country,false)).toBeNull();
    expect(bookingEntryRedirect({countryCode:'FR'},country,false)).toBeNull();
  }
});

it('suggests a supported foreign market only for a fresh entry',()=>{
  expect(bookingEntryRedirect({},'FR',true)).toBe('/international/booking?countryCode=FR');
  expect(bookingEntryRedirect({utm_source:'campaign'},'ES',true)).toBe('/international/booking?countryCode=ES');
  for(const country of ['RO','US',null,'unknown'])expect(bookingEntryRedirect({},country,true)).toBeNull();
});

it('preserves Romanian intent and existing city, draft, provider and future-client links',()=>{
  for(const query of [{countryCode:'RO'},{countryCode:' ro '},{city:'Constanța',sqm:'60'},
    {preferredFirmId:'synthetic-firm'},{quoteId:'synthetic-quote'},{futureClientField:'opaque-value'}]) {
    expect(bookingEntryRedirect(query,'FR',true)).toBeNull();
  }
});

it('honors an explicit work country over IP without accepting an external redirect',()=>{
  expect(bookingEntryRedirect({countryCode:'es',city:'old-city'},'FR',true)).toBe('/international/booking?countryCode=ES');
  for(const countryCode of ['US','', '//example.invalid',['FR','RO']]) {
    expect(bookingEntryRedirect({countryCode},'FR',true)).toBe('/international/booking?countryCode=');
  }
});

it('does not invent a foreign work country from an unsupported or ambiguous suggestion',()=>{
  expect(internationalInitialCountry(undefined,'FR')).toBe('FR');
  expect(internationalInitialCountry('ES','FR')).toBe('ES');
  expect(internationalInitialCountry('US','FR')).toBe('');
  expect(internationalInitialCountry(['FR','ES'],'FR')).toBe('');
  expect(internationalInitialCountry(undefined,'RO')).toBeUndefined();
  expect(internationalInitialCountry(undefined,'US')).toBeUndefined();
  expect(foreignBookingCountry('RO')).toBeUndefined();
  const explicitChooser=internationalBookingHref(internationalInitialCountry('US','FR'));
  expect(explicitChooser).toBe('/international/booking?countryCode=');
  expect(new URL(explicitChooser,'https://nitido.invalid').searchParams.get('countryCode')).toBe('');
});
