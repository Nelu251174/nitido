import {afterEach,describe,it,expect,vi} from 'vitest';
import {bookingCalendarDays,isBookableRomanianSlot,bookingDateKey,bucharestScheduledAt,nextBucharestSlot,hasSchedulingLeadTime} from './scheduling';
afterEach(()=>vi.unstubAllEnvs());
describe('Romanian booking calendar independent of server timezone',()=>{
 it.each(['UTC','Europe/Bucharest','America/New_York'])('keeps winter and summer appointments at the selected local hour on %s',tz=>{vi.stubEnv('TZ',tz);expect(bucharestScheduledAt('2026-09-12',10).toISOString()).toBe('2026-09-12T07:00:00.000Z');expect(bucharestScheduledAt('2026-12-12',10).toISOString()).toBe('2026-12-12T08:00:00.000Z')});
 it('handles both daylight saving transitions at bookable hours',()=>{expect(bucharestScheduledAt('2026-03-29',8).toISOString()).toBe('2026-03-29T05:00:00.000Z');expect(bucharestScheduledAt('2026-10-25',8).toISOString()).toBe('2026-10-25T06:00:00.000Z')});
 it('accepts civil dates and legacy web/mobile timestamps without losing the selected day',()=>{expect(bookingDateKey('2026-09-12')).toBe('2026-09-12');expect(bookingDateKey('2026-09-12T00:00:00')).toBe('2026-09-12');expect(bookingDateKey('2026-09-11T21:00:00.000Z')).toBe('2026-09-12')});
 it.each(['2026-02-31','2026-02-31T12:00:00Z','invalid','2026-13-01','2026-09-12 trailing text'])('rejects invalid date %s',value=>{expect(bookingDateKey(value)).toBeNull()});
 it('selects ASAP using Romanian current time and observes the exact minimum lead',()=>{const now=new Date('2026-09-11T06:00:00Z');expect(nextBucharestSlot(now)?.toISOString()).toBe('2026-09-11T07:00:00.000Z');expect(hasSchedulingLeadTime(new Date('2026-09-11T06:59:59Z'),now)).toBe(false)});
 it('rolls late evening over to the next local date, including at month end',()=>{expect(nextBucharestSlot(new Date('2026-09-30T22:30:00Z'))?.toISOString()).toBe('2026-10-01T05:00:00.000Z')});
});

describe('client booking calendar and stale selections',()=>{
 it.each(['UTC','Europe/Bucharest','America/Los_Angeles','Pacific/Auckland'])('uses the Romanian day and lead time on devices in %s',tz=>{
  vi.stubEnv('TZ',tz);
  expect(bookingCalendarDays(new Date('2026-09-30T22:30:00Z'),2)).toEqual(['2026-10-01','2026-10-02']);
  expect(isBookableRomanianSlot('2026-09-13',14,new Date('2026-09-13T10:00:00Z'))).toBe(true);
  expect(isBookableRomanianSlot('2026-09-13',14,new Date('2026-09-13T10:00:01Z'))).toBe(false);
 });
 it('keeps fourteen civil dates across the autumn clock change',()=>{
  const days=bookingCalendarDays(new Date('2026-10-24T21:30:00Z'));
  expect(days).toHaveLength(14);expect(new Set(days).size).toBe(14);
  expect(days[0]).toBe('2026-10-25');expect(days[13]).toBe('2026-11-07');
 });
 it('invalidates a restored selection that became too close during card setup',()=>{
  expect(isBookableRomanianSlot('2026-09-13',14,new Date('2026-09-13T09:55:00Z'))).toBe(true);
  expect(isBookableRomanianSlot('2026-09-13',14,new Date('2026-09-13T10:05:00Z'))).toBe(false);
 });
 it.each([['2026-02-30',14],['2026-09-13',13],['2026-09-13',null],['bad',14]] as const)('rejects invalid date or hour %s %s',(day,hour)=>{
  expect(isBookableRomanianSlot(day,hour,new Date('2026-01-01T00:00:00Z'))).toBe(false);
 });
});
