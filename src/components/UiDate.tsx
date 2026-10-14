import {useLocale} from 'next-intl';

/** Display formatting follows language; operational dates keep their time zone. */
export function UiDate({value,kind='dateTime',options}:{value:Date;kind?:'date'|'time'|'dateTime';options?:Intl.DateTimeFormatOptions}) {
  const locale=useLocale();
  const format={timeZone:'Europe/Bucharest',...options};
  return kind==='date'?value.toLocaleDateString(locale,format):kind==='time'?value.toLocaleTimeString(locale,format):value.toLocaleString(locale,format);
}
