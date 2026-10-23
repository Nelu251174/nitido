import 'server-only';
import type {Metadata} from 'next';
import {getLocale, getMessages} from 'next-intl/server';
import {translateText,translateTemplate, type UiCatalog} from './text';
import {asLocale,SOCIAL_LOCALES,DEFAULT_LOCALE} from './locales';

export async function getUiText() {
  const {ui} = await getMessages();
  return (source: string,values?:readonly (string|number)[]) => values?translateTemplate(ui as UiCatalog,source,values):translateText(ui as UiCatalog, source);
}
/** Only metadata display fields: URLs and verification/robots settings stay exact. */
export async function localizeMetadata(metadata: Metadata): Promise<Metadata> {
  const ui = await getUiText();
  const locale = await getLocale();
  const title = (value: Metadata['title']): Metadata['title'] => {
    if(typeof value === 'string')return ui(value);
    if(!value)return value;
    if('absolute' in value)return {...value, absolute:ui(value.absolute)};
    return {...value, default:ui(value.default), template:value.template};
  };
  // Adding an absent field as `undefined` clears the parent layout's metadata.
  const localized = {...metadata};
  if (metadata.title !== undefined) localized.title = title(metadata.title);
  if (metadata.description) localized.description = ui(metadata.description);
  if (metadata.openGraph) localized.openGraph = {...metadata.openGraph,locale:SOCIAL_LOCALES[asLocale(locale)??DEFAULT_LOCALE], title:title(metadata.openGraph.title)??undefined,description:metadata.openGraph.description?ui(metadata.openGraph.description):undefined};
  if (metadata.twitter) localized.twitter = {...metadata.twitter,title:title(metadata.twitter.title)??undefined,description:metadata.twitter.description?ui(metadata.twitter.description):undefined};
  return localized;
}
