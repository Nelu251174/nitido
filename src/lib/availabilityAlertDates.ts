import {bucharestDateKey} from './scheduling';
/** Calendar days, not 144 elapsed hours: stable across Romania's DST change. */
export function availabilityAlertDates(now=new Date()){
  const min=bucharestDateKey(now),last=new Date(min+'T12:00:00Z');last.setUTCDate(last.getUTCDate()+6);
  return {min,max:last.toISOString().slice(0,10)};
}
