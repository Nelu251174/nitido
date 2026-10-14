export type UiCatalog = Record<string, string>;
export function normalizeText(text: string): string { return text.replace(/\s+/g, ' ').trim(); }
/** Stable UTF-16 key; collisions are rejected by the catalog builder. */
export function textKey(text: string): string {
  let a = 0x811c9dc5, b = 0x9e3779b9;
  for (const char of normalizeText(text)) {
    const cp = char.codePointAt(0)!;
    a = Math.imul(a ^ cp, 0x01000193);
    b = Math.imul(b ^ cp, 0x85ebca6b);
  }
  return `t${(a >>> 0).toString(16)}_${(b >>> 0).toString(16)}`;
}
export function translateText(catalog: UiCatalog, source: string): string {
  if(/^(?:NITIDO(?:\.RO| Pro)?|N|Nit|ido|\.RO)$/i.test(normalizeText(source)))return source;
  const translated = catalog[textKey(source)];
  if (!translated) return source;
  // JSX fragments need their spaces when adjacent to numbers or names.
  return `${source.match(/^\s*/)?.[0] ?? ''}${translated}${source.match(/\s*$/)?.[0] ?? ''}`;
}
/** Runtime values are substituted after translation and never sent to a provider. */
export function translateTemplate(catalog:UiCatalog,source:string,values:readonly (string|number)[]):string {
  return translateText(catalog,source).replace(/\{p(\d+)\}/g,(slot,index)=>values[Number(index)]===undefined?slot:String(values[Number(index)]));
}
