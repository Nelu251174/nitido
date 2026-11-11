import {expect,it} from 'vitest';
import {internationalLocalSchedule,internationalScheduledAt,internationalTimezone} from './internationalScheduling';

it('uses the work country instead of the device/visitor timezone',()=>{
  expect(internationalScheduledAt('DE','2026-11-10',10).toISOString()).toBe('2026-11-10T09:00:00.000Z');
  expect(internationalScheduledAt('PT','2026-11-10',10).toISOString()).toBe('2026-11-10T10:00:00.000Z');
  expect(internationalScheduledAt('FI','2026-11-10',10).toISOString()).toBe('2026-11-10T08:00:00.000Z');
});
it('applies summertime in mainland service cities',()=>{
  expect(internationalLocalSchedule('ES','2027-07-01T10:30').toISOString()).toBe('2027-07-01T08:30:00.000Z');
  expect(internationalLocalSchedule('PT','2027-07-01T10:30').toISOString()).toBe('2027-07-01T09:30:00.000Z');
});
it('rejects non-existent and repeated civil times at DST transitions',()=>{
  expect(()=>internationalLocalSchedule('DE','2027-03-28T02:30')).toThrow('AMBIGUOUS_OR_UNAVAILABLE_WORK_TIME');
  expect(()=>internationalLocalSchedule('DE','2026-10-25T02:30')).toThrow('AMBIGUOUS_OR_UNAVAILABLE_WORK_TIME');
});
it.each(['2027-02-29T10:00','2026-11-31T10:00','2026-11-10T24:00','2026-11-10T10:70','not-a-date'])
('rejects invalid civil time %s',local=>expect(()=>internationalLocalSchedule('FR',local)).toThrow());
it('does not change the Romanian scheduling path or infer unsupported countries',()=>{
  expect(()=>internationalTimezone('RO')).toThrow('ROMANIAN_SCHEDULING_USES_EXISTING_CONTRACT');
  expect(()=>internationalTimezone('US')).toThrow();
});
