import {createElement, Fragment, type JSX, type ReactNode} from 'react';
import {useMessages} from 'next-intl';
import {translateText,translateTemplate, type UiCatalog} from '@/i18n/text';

/** Shared server/client component: only source-owned UI copy belongs here. */
export function UiText({text}: {text: string | number | null | undefined}) {
  const {ui} = useMessages();
  return typeof text === 'string' ? translateText(ui as UiCatalog, text) : text;
}
export function useUiText() {
  const {ui} = useMessages();
  return (source: string,values?:readonly (string|number)[]) => values?translateTemplate(ui as UiCatalog,source,values):translateText(ui as UiCatalog, source);
}
/** Stored service keys stay unchanged; only their display labels are localized. */
export function UiSpaceType({value}:{value:string}) {
  const labels:Record<string,string>={apartament:'Apartament',casa:'Casă',birou:'Birou',altul:'Alt spațiu'};
  return labels[value]?<UiText text={labels[value]}/>:value;
}
/** Named slots allow each language to reorder values without translating them. */
export function UiTemplate({text, values}: {text: string; values: ReactNode[]}) {
  const {ui} = useMessages();
  const translated = translateText(ui as UiCatalog, text);
  return translated.split(/(\{p\d+\})/g).map((part, index) => {
    const slot = /^\{p(\d+)\}$/.exec(part);
    return <Fragment key={index}>{slot ? values[Number(slot[1])] : part}</Fragment>;
  });
}
/** Translate display attributes; never form values, names, URLs or event handlers. */
export function UiElement<T extends keyof JSX.IntrinsicElements>(props: {as: T} & JSX.IntrinsicElements[T]) {
  const {as, ...attributes} = props;
  const {ui} = useMessages();
  const display = {...attributes} as Record<string, unknown>;
  for (const name of ['placeholder', 'title', 'aria-label', 'alt']) {
    if (typeof display[name] === 'string') display[name] = translateText(ui as UiCatalog, display[name]);
  }
  return createElement(as, display);
}
