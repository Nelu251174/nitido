import 'server-only';
import {LANGUAGES,type Locale} from './locales';
import {type UiCatalog} from './text';
import source from '../../messages/ro.json';
import manifest from '../../messages/manifest.json';

/** An incomplete catalog must never masquerade as a supported language. */
export function catalogsReady(): boolean {
  return manifest.complete && manifest.languages === LANGUAGES.length && LANGUAGES.some(([locale])=>locale==='ro') && manifest.sourceMessages === Object.keys(source).length;
}
export async function getCatalog(locale: Locale): Promise<UiCatalog> {
  if (locale === 'ro' || !catalogsReady() || !LANGUAGES.some(([released])=>released===locale)) return source;
  const catalogModule = await import(`../../messages/${locale}.json`);
  return catalogModule.default as UiCatalog;
}
