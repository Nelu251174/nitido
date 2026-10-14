import 'server-only';
import {type Locale} from './locales';
import {type UiCatalog} from './text';
import source from '../../messages/ro.json';
import manifest from '../../messages/manifest.json';

/** An incomplete catalog must never masquerade as a supported language. */
export function catalogsReady(): boolean {
  return manifest.complete && manifest.languages === 24 && manifest.sourceMessages === Object.keys(source).length;
}
export async function getCatalog(locale: Locale): Promise<UiCatalog> {
  if (locale === 'ro' || !catalogsReady()) return source;
  const module = await import(`../../messages/${locale}.json`);
  return module.default as UiCatalog;
}
