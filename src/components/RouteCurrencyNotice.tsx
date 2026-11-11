'use client';

import {usePathname} from 'next/navigation';
import {CurrencyNotice} from './CurrencyNotice';

/** Native EUR offers do not convert a Romanian price or collect RON. */
export function RouteCurrencyNotice(){
  const path=usePathname();
  if(path==='/international/booking'||path==='/international/preview')return null;
  return <CurrencyNotice/>;
}
