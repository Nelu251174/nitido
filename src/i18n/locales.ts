import manifest from '../../messages/manifest.json';
/** EU language expansion inventory; release selection uses complete catalogs only. */
export const ALL_EU_LANGUAGES = [
  ['bg', 'Български'], ['hr', 'Hrvatski'], ['cs', 'Čeština'], ['da', 'Dansk'],
  ['nl', 'Nederlands'], ['en', 'English'], ['et', 'Eesti'], ['fi', 'Suomi'],
  ['fr', 'Français'], ['de', 'Deutsch'], ['el', 'Ελληνικά'], ['hu', 'Magyar'],
  ['ga', 'Gaeilge'], ['it', 'Italiano'], ['lv', 'Latviešu'], ['lt', 'Lietuvių'],
  ['mt', 'Malti'], ['pl', 'Polski'], ['pt', 'Português'], ['ro', 'Română'],
  ['sk', 'Slovenčina'], ['sl', 'Slovenščina'], ['es', 'Español'], ['sv', 'Svenska'],
] as const;
export type Locale = typeof ALL_EU_LANGUAGES[number][0];
export const LANGUAGES = ALL_EU_LANGUAGES.filter(([locale])=>manifest.locales.includes(locale));
export const LOCALE_COOKIE = 'nitido-language';
export const DEFAULT_LOCALE: Locale = 'ro';
/** Open Graph requires language_TERRITORY; this never selects billing country. */
export const SOCIAL_LOCALES: Record<Locale,string> = {
  bg:'bg_BG',hr:'hr_HR',cs:'cs_CZ',da:'da_DK',nl:'nl_NL',en:'en_GB',
  et:'et_EE',fi:'fi_FI',fr:'fr_FR',de:'de_DE',el:'el_GR',hu:'hu_HU',
  ga:'ga_IE',it:'it_IT',lv:'lv_LV',lt:'lt_LT',mt:'mt_MT',pl:'pl_PL',
  pt:'pt_PT',ro:'ro_RO',sk:'sk_SK',sl:'sl_SI',es:'es_ES',sv:'sv_SE',
};
export function asLocale(value: string | null | undefined): Locale | undefined {
  const code = value?.trim().toLowerCase().replaceAll('_', '-').split('-')[0];
  return LANGUAGES.find(([locale]) => locale === code)?.[0];
}
const COUNTRY_LANGUAGES: Record<string, Locale> = {
  BG: 'bg', HR: 'hr', CZ: 'cs', DK: 'da', NL: 'nl', GB: 'en', IE: 'en',
  EE: 'et', FI: 'fi', FR: 'fr', DE: 'de', AT: 'de', GR: 'el', CY: 'el',
  HU: 'hu', IT: 'it', LV: 'lv', LT: 'lt', MT: 'mt', PL: 'pl', PT: 'pt',
  RO: 'ro', MD: 'ro', SK: 'sk', SI: 'sl', ES: 'es', SE: 'sv',
};
/** Never infer one language for multilingual countries such as Belgium. */
export function selectLocale(manual?: string | null, acceptLanguage?: string | null, country?: string | null): Locale {
  const chosen = asLocale(manual);
  if (chosen) return chosen;
  const preferences = (acceptLanguage ?? '').split(',').map((part, index) => {
    const [tag, ...params] = part.trim().split(';');
    const qText = params.find(p => p.trim().startsWith('q='))?.trim().slice(2);
    const quality = qText === undefined ? 1 : Number(qText);
    return {locale: asLocale(tag), quality, index};
  }).filter(p => p.locale && Number.isFinite(p.quality) && p.quality > 0 && p.quality <= 1)
    .sort((a, b) => b.quality - a.quality || a.index - b.index);
  return preferences[0]?.locale ?? asLocale(COUNTRY_LANGUAGES[country?.toUpperCase() ?? '']) ?? DEFAULT_LOCALE;
}
export function hasSupportedLanguage(header?: string | null): boolean {
  return (header ?? '').split(',').some(part => {
    const [tag, ...params] = part.trim().split(';');
    const qText=params.find(p=>p.trim().startsWith('q='))?.trim().slice(2);
    const quality=qText===undefined?1:Number(qText);
    return Boolean(asLocale(tag))&&Number.isFinite(quality)&&quality>0&&quality<=1;
  });
}
