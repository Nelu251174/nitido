import {createElement, Fragment, type ElementType, type ComponentPropsWithRef, type ReactNode} from 'react';
import {useMessages,useLocale} from 'next-intl';
import {currencyFromMessages,displayMoneyText,displayMoney,euroEnabled} from '@/lib/displayCurrency';
import {translateText,translateTemplate, type UiCatalog} from '@/i18n/text';

/** Shared server/client component: only source-owned UI copy belongs here. */
export function UiText({text}: {text: string | number | null | undefined}) {
  const messages=useMessages(),{ui}=messages;
  const currency=currencyFromMessages(messages),locale=useLocale();
  return typeof text === 'string' ? displayMoneyText(translateText(ui as UiCatalog, text),currency,locale) : text;
}
export function useUiText() {
  const messages=useMessages(),{ui}=messages;
  const currency=currencyFromMessages(messages),locale=useLocale();
  return (source: string,values?:readonly (string|number)[]) => displayMoneyText(values?translateTemplate(ui as UiCatalog,source,values):translateText(ui as UiCatalog, source),currency,locale);
}
/** Stored service keys stay unchanged; only their display labels are localized. */
export function UiSpaceType({value}:{value:string}) {
  const labels:Record<string,string>={apartament:'Apartament',casa:'Casă',birou:'Birou',altul:'Alt spațiu'};
  return labels[value]?<UiText text={labels[value]}/>:value;
}
/** Named slots allow each language to reorder values without translating them. */
export function UiTemplate({text, values,moneySlots=[]}: {text: string; values: ReactNode[];moneySlots?:number[]}) {
  const messages=useMessages(),{ui}=messages;
  const currency=currencyFromMessages(messages),locale=useLocale();
  const monetarySlots=new Set<number>(euroEnabled(currency)?moneySlots:[]);
  const translated = translateText(ui as UiCatalog, text).replace(/(\{p(\d+)\})\s*(?:lei|RON|леи|лея|leja)(?=$|[^\p{L}])/giu,(full,slot,index)=>{
    if(!euroEnabled(currency))return full;
    const value=values[Number(index)];
    if(typeof value!=='number'&&typeof value!=='string')return full;
    monetarySlots.add(Number(index));return slot;
  });
  return translated.split(/(\{p\d+\})/g).map((part, index) => {
    const slot = /^\{p(\d+)\}$/.exec(part);
    return <Fragment key={index}>{slot ? (monetarySlots.has(Number(slot[1]))?displayMoney(Number(String(values[Number(slot[1])]).replace(',','.')),currency,locale):values[Number(slot[1])]) : displayMoneyText(part,currency,locale)}</Fragment>;
  });
}
/** Translate display attributes; never form values, names, URLs or event handlers. */
export function UiElement<T extends ElementType>(props: {as: T} & Omit<ComponentPropsWithRef<T>,'as'>) {
  const {as, ...attributes} = props;
  const {ui}=useMessages();
  const display = {...attributes} as Record<string, unknown>;
  for (const name of ['placeholder', 'title', 'aria-label', 'alt']) {
    if (typeof display[name] === 'string') display[name] = translateText(ui as UiCatalog, display[name]);
  }
  return createElement(as, display);
}
