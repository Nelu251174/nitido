import {afterEach,describe,it,expect,vi} from 'vitest';
import {bookingDateKey,bucharestScheduledAt,nextBucharestSlot,hasSchedulingLeadTime} from './scheduling';
afterEach(()=>vi.unstubAllEnvs());
describe('Romanian booking calendar independent of server timezone',()=>{
 it.each(['UTC','Europe/Bucharest','America/New_York'])('keeps winter and summer appointments at the selected local hour on %s',tz=>{vi.stubEnv('TZ',tz);expect(bucharestScheduledAt('2026-09-12',10).toISOString()).toBe('2026-09-12T07:00:00.000Z');expect(bucharestScheduledAt('2026-12-12',10).toISOString()).toBe('2026-12-12T08:00:00.000Z')});
 it('handles both daylight saving transitions at bookable hours',()=>{expect(bucharestScheduledAt('2026-03-29',8).toISOString()).toBe('2026-03-29T05:00:00.000Z');expect(bucharestScheduledAt('2026-10-25',8).toISOString()).toBe('2026-10-25T06:00:00.000Z')});
 it('accepts civil dates and legacy web/mobile timestamps without losing the selected day',()=>{expect(bookingDateKey('2026-09-12')).toBe('2026-09-12');expect(bookingDateKey('2026-09-12T00:00:00')).toBe('2026-09-12');expect(bookingDateKey('2026-09-11T21:00:00.000Z')).toBe('2026-09-12')});
 it.each(['2026-02-31','2026-02-31T12:00:00Z','invalid','2026-13-01','2026-09-12 trailing text'])('rejects invalid date %s',value=>{expect(bookingDateKey(value)).toBeNull()});
 it('selects ASAP using Romanian current time and observes the exact minimum lead',()=>{const now=new Date('2026-09-11T06:00:00Z');expect(nextBucharestSlot(now)?.toISOString()).toBe('2026-09-11T07:00:00.000Z');expect(hasSchedulingLeadTime(new Date('2026-09-11T06:59:59Z'),now)).toBe(false)});
 it('rolls late evening over to the next local date, including at month end',()=>{expect(nextBucharestSlot(new Date('2026-09-30T22:30:00Z'))?.toISOString()).toBe('2026-10-01T05:00:00.000Z')});
});
