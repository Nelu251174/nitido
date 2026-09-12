import {describe,it,expect} from 'vitest';
import {calendarDays,shiftCalendarDate,intersectsServiceDay,serviceDate} from './calendarView';
describe('service calendar dates',()=>{
 it('starts weeks on Monday and includes surrounding days in a six-week month',()=>{expect(calendarDays('2026-09-13','week')).toEqual(['2026-09-07','2026-09-08','2026-09-09','2026-09-10','2026-09-11','2026-09-12','2026-09-13']);const days=calendarDays('2026-02-15','month');expect(days).toHaveLength(42);expect(days[0]).toBe('2026-01-26');expect(days.at(-1)).toBe('2026-03-08')});
 it('clamps month navigation and crosses year/leap boundaries',()=>{expect(shiftCalendarDate('2026-01-31',1,'month')).toBe('2026-02-28');expect(shiftCalendarDate('2024-01-31',1,'month')).toBe('2024-02-29');expect(shiftCalendarDate('2026-12-31',1,'day')).toBe('2027-01-01')});
 it('uses Romanian dates near midnight regardless of the device timezone',()=>{expect(serviceDate('2026-09-11T22:30:00Z')).toBe('2026-09-12')});
 it('does not occupy the following day when an interval ends exactly at midnight',()=>{expect(intersectsServiceDay('2026-09-11T20:00:00Z','2026-09-11T21:00:00Z','2026-09-12')).toBe(false);expect(intersectsServiceDay('2026-09-11T20:00:00Z','2026-09-11T21:30:00Z','2026-09-12')).toBe(true)});
 it('handles DST transitions and rejects invalid intervals',()=>{expect(intersectsServiceDay('2026-03-28T22:00:00Z','2026-03-29T21:00:00Z','2026-03-29')).toBe(true);expect(intersectsServiceDay('bad','bad','2026-03-29')).toBe(false)});
});
