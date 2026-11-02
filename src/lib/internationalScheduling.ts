import {serviceCountry, type ServiceCountry} from './serviceMarkets';

const TIMEZONES: Record<Exclude<ServiceCountry, 'RO'>, string> = {
  AT:'Europe/Vienna', BE:'Europe/Brussels', BG:'Europe/Sofia', HR:'Europe/Zagreb',
  CY:'Asia/Nicosia', CZ:'Europe/Prague', DK:'Europe/Copenhagen', EE:'Europe/Tallinn',
  FI:'Europe/Helsinki', FR:'Europe/Paris', DE:'Europe/Berlin', GR:'Europe/Athens',
  HU:'Europe/Budapest', IE:'Europe/Dublin', IT:'Europe/Rome', LV:'Europe/Riga',
  LT:'Europe/Vilnius', LU:'Europe/Luxembourg', MT:'Europe/Malta', NL:'Europe/Amsterdam',
  PL:'Europe/Warsaw', PT:'Europe/Lisbon', SK:'Europe/Bratislava', SI:'Europe/Ljubljana',
  ES:'Europe/Madrid', SE:'Europe/Stockholm',
};

/** The supported city catalogue uses mainland zones; no inference from visitor IP. */
export function internationalTimezone(value: unknown): string {
  const country=serviceCountry(value);
  if(country==='RO')throw Error('ROMANIAN_SCHEDULING_USES_EXISTING_CONTRACT');
  return TIMEZONES[country];
}

function wall(date: Date, timeZone: string): number {
  const parts=new Intl.DateTimeFormat('en-GB', {timeZone,year:'numeric',month:'2-digit',day:'2-digit',
    hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date);
  const n=(key:string)=>Number(parts.find(p=>p.type===key)?.value);
  return Date.UTC(n('year'),n('month')-1,n('day'),n('hour'),n('minute'),n('second'));
}

/** Resolve local work time; reject DST gaps and repeated/ambiguous wall times. */
export function internationalScheduledAt(country: unknown, date: string, hour: number, minute=0): Date {
  const zone=internationalTimezone(country);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isInteger(hour)||hour<0||hour>23
    ||!Number.isInteger(minute)||minute<0||minute>59)throw Error('INVALID_WORK_SCHEDULE');
  const [y,m,d]=date.split('-').map(Number),target=Date.UTC(y,m-1,d,hour,minute);
  if(new Date(target).toISOString().slice(0,10)!==date)throw Error('INVALID_WORK_SCHEDULE');
  const offsets=new Set<number>();
  for(const shift of [-36,0,36]){
    const instant=new Date(target+shift*3600000);
    offsets.add(wall(instant,zone)-instant.getTime());
  }
  const candidates=[...offsets].map(offset=>new Date(target-offset)).filter(d=>wall(d,zone)===target);
  if(candidates.length!==1)throw Error('AMBIGUOUS_OR_UNAVAILABLE_WORK_TIME');
  return candidates[0];
}

export function internationalLocalSchedule(country:unknown, local:unknown):Date {
  if(typeof local!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local))throw Error('INVALID_WORK_SCHEDULE');
  return internationalScheduledAt(country,local.slice(0,10),Number(local.slice(11,13)),Number(local.slice(14,16)));
}
