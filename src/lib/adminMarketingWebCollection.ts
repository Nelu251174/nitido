import { load,type CheerioAPI } from 'cheerio';
import { CITIES } from './cities';
import { marketingKey, MarketingError, normalizeMarketingInput } from './adminMarketing';
import type { MarketingInput } from './adminMarketingShared';
import { publicWebsite, readPublicPage, type PublicReader } from './adminMarketingPublicWeb';

// OSM's public instance list documents this service as available for any project.
export const MARKETING_PUBLIC_SOURCE = 'https://overpass.private.coffee/api/interpreter';
const sectors: Record<string, string[]> = {
  all: ['[office]', '[shop]', '[tourism~"^(hotel|guest_house|hostel)$"]', '[amenity~"^(restaurant|cafe|clinic|bank)$"]'],
  hotels: ['[tourism~"^(hotel|guest_house|hostel)$"]'], restaurants: ['[amenity~"^(restaurant|cafe)$"]'], offices: ['[office]'], shops: ['[shop]'],
};
const emailPattern = /[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+/gi;
export function publicEmails(text: string): string[] {
  return [...new Set((text.match(emailPattern) ?? []).map(value => value.toLowerCase().replace(/[.,;:]+$/, '')).filter(value => value.length <= 254 && !/\.(png|jpe?g|svg|webp|gif|css|js)$/i.test(value) && !/^(example|test|noreply|no-reply)@/.test(value)))].sort((a, b) => Number(!/^(contact|office|info|hello|rezervari)@/.test(a)) - Number(!/^(contact|office|info|hello|rezervari)@/.test(b)) || a.localeCompare(b));
}
/** Keep adjacent DOM nodes separated; concatenating text can invent an email address. */
export function marketingVisibleText($:CheerioAPI,selector:string){return $(selector).find('*').addBack().contents().filter((_,node)=>node.type==='text').map((_,node)=>node.type==='text'?node.data:'').get().join(' ');}
export function extractBusinessPage(html: string, base: string) {
  const $ = load(html); $('script,style,noscript,template').remove();
  const emails = publicEmails($('a[href^="mailto:"]').map((_, node) => $(node).attr('href')?.slice(7).split('?')[0] ?? '').get().join(' ') + ' ' + marketingVisibleText($,'body'));
  const url = new URL(base), links: string[] = [];
  $('a[href]').each((_, node) => {
    const href = $(node).attr('href') ?? '', text = $(node).text();
    if (!/contact|despre|about/i.test(href + ' ' + text)) return;
    try { const link = publicWebsite(new URL(href, url).href); if (link.origin === url.origin && !links.includes(link.href)) links.push(link.href); } catch { /* Ignore non-public links. */ }
  });
  return { name: ($('meta[property="og:site_name"]').attr('content') || $('title').text() || url.hostname).replace(/\s+/g, ' ').trim().slice(0, 180), emails, links: links.slice(0, 2) };
}
/** Match applicable robots groups; collection never bypasses an explicit disallow or a failed robots read. */
export function robotsAllows(text: string, pathname: string): boolean {
  const groups: { agents: string[]; rules: { allow: boolean; path: string }[] }[] = []; let group = { agents: [] as string[], rules: [] as { allow: boolean; path: string }[] };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.split('#')[0].trim(), split = line.indexOf(':'); if (split < 0) continue;
    const key = line.slice(0, split).toLowerCase(), value = line.slice(split + 1).trim();
    if (key === 'user-agent') { if (group.rules.length) { groups.push(group); group = { agents: [], rules: [] }; } group.agents.push(value.toLowerCase()); }
    else if (['allow', 'disallow'].includes(key) && group.agents.length && value) group.rules.push({ allow: key === 'allow', path: value });
  }
  groups.push(group);
  const specific = groups.filter(item => item.agents.some(agent => agent !== '*' && 'nitido-marketing'.startsWith(agent)));
  const relevant = specific.length ? specific : groups.filter(item => item.agents.includes('*'));
  const matches = relevant.flatMap(item => item.rules).filter(rule => {
    const end = rule.path.endsWith('$'), path = rule.path.replace(/\$$/, '').split('*').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*');
    return new RegExp('^' + path + (end ? '$' : '')).test(pathname);
  }).sort((a, b) => b.path.length - a.path.length || Number(b.allow) - Number(a.allow));
  return !matches.length || matches[0].allow;
}
export async function collectBusinessWebsite(website: string, reader: PublicReader = readPublicPage, depth = 0, includeContactPages = false) {
  if (depth > 3) throw new MarketingError('Prea multe redirecționări ale site-ului.');
  const start = publicWebsite(website), robots = await reader(new URL('/robots.txt', start).href, { maxBytes: 100000, redirects: false });
  if (robots.status !== 404 && (robots.status < 200 || robots.status >= 300)) throw new MarketingError('Fișierul robots.txt nu poate fi verificat.');
  const rules = robots.status === 404 ? '' : robots.text;
  if (!robotsAllows(rules, start.pathname)) throw new MarketingError('Site-ul nu permite colectarea automată pentru această pagină.');
  const first = await reader(start.href, { redirects: false });
  if ([301,302,303,307,308].includes(first.status) && first.headers.location) return collectBusinessWebsite(new URL(first.headers.location, start).href, reader, depth + 1, includeContactPages);
  if (first.status !== 200 || !/text\/html|application\/xhtml/i.test(String(first.headers['content-type'] ?? ''))) throw new MarketingError('Pagina publică a firmei nu este disponibilă ca HTML.');
  if (new URL(first.url).origin !== start.origin || !robotsAllows(rules, new URL(first.url).pathname)) throw new MarketingError('Redirecționarea nu este permisă pentru colectare.');
  const page = extractBusinessPage(first.text, first.url), found = page.emails.map(email => ({ email, source: first.url }));
  for (const link of page.links) {
    if (found.length && !includeContactPages) break;
    if (!robotsAllows(rules, new URL(link).pathname)) continue;
    try { const next = await reader(link, { redirects: false }); if (next.status === 200 && new URL(next.url).origin === start.origin && robotsAllows(rules, new URL(next.url).pathname)) for (const email of extractBusinessPage(next.text, next.url).emails) found.push({ email, source: next.url }); } catch { /* A failed public contact page does not invent an email. */ }
  }
  return { name: page.name, website: start.href, found };
}
export function discoveryQuery(city: string, category: string, sector: string, limit: number) {
  const canonical = CITIES.find(item => marketingKey(item.name) === marketingKey(city))?.name ?? city.trim();
  const quoted = JSON.stringify(canonical);
  const cityQuery = marketingKey(canonical) === 'bucuresti' ? 'rel(area.ro)["ISO3166-2"="RO-B"];' : `rel(area.ro)["boundary"="administrative"]["admin_level"~"^(8|9)$"]["name"=${quoted}];`;
  const filters = category === 'cleaning' ? ['["office"="cleaning"]', '["craft"="cleaning"]', '["name"~"cur[ăa][țt]enie|cleaning",i]'] : sectors[sector];
  if (!filters) throw new MarketingError('Domeniu de activitate invalid.');
  return `[out:json][timeout:20][maxsize:3000000];area["ISO3166-1"="RO"]->.ro;${cityQuery}map_to_area->.city;(${filters.map(filter => `nwr(area.city)["name"]${filter};`).join('')});out tags center ${limit};`;
}
type OSM = { type: string; id: number; tags: Record<string, string> };
export async function collectMarketingWeb(value: unknown, reader: PublicReader = readPublicPage, progress?: (completed: number, total: number) => void) {
  if (!value || typeof value !== 'object') throw new MarketingError('Cerere de colectare invalidă.');
  const b = value as Record<string, unknown>;
  if (!['business', 'cleaning'].includes(String(b.category))) throw new MarketingError('Colectarea publică este disponibilă numai pentru firme, nu pentru persoane fizice.');
  if (typeof b.city !== 'string' || !b.city.trim() || b.city.length > 100 || /[\x00-\x1f]/.test(b.city)) throw new MarketingError('Completează localitatea.');
  const city = CITIES.find(item => marketingKey(item.name) === marketingKey(b.city as string))?.name ?? b.city.trim(), limit = Number(b.limit ?? 10);
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) throw new MarketingError('Colectează între 1 și 20 de firme per rulare.');
  const supplied = typeof b.websites === 'string' ? [...new Set(b.websites.split(/[\r\n]+/).map(text => text.trim()).filter(Boolean))] : [];
  if (supplied.length > 20) throw new MarketingError('Maximum 20 de site-uri per rulare.');
  const contacts: MarketingInput[] = [], warnings: string[] = []; let candidates: { name: string; website: string; email: string; source: string; phone: string }[];
  if (supplied.length) candidates = supplied.slice(0, limit).map(site => ({ name: '', website: publicWebsite(site).href, email: '', source: site, phone: '' }));
  else {
    let entries: OSM[];
    try {
      const response = await reader(MARKETING_PUBLIC_SOURCE, { method: 'POST', body: new URLSearchParams({ data: discoveryQuery(city, String(b.category), String(b.sector ?? 'all'), limit) }).toString(), timeoutMs: 25000, maxBytes: 250000 });
      const data = JSON.parse(response.text); if (response.status !== 200 || !Array.isArray(data.elements) || data.remark) throw Error(); entries = data.elements;
    } catch { throw new MarketingError('Sursa publică de firme nu este disponibilă acum. Reîncearcă sau introdu site-urile firmelor cunoscute.', 502); }
    candidates = entries.slice(0, limit).map(entry => ({ name: String(entry.tags?.name ?? '').slice(0, 180), website: entry.tags?.['contact:website'] || entry.tags?.website || '', email: publicEmails(entry.tags?.['contact:email'] || entry.tags?.email || '')[0] ?? '', source: `https://www.openstreetmap.org/${entry.type}/${entry.id}`, phone: String(entry.tags?.['contact:phone'] || entry.tags?.phone || '').slice(0, 50) }));
  }
  const seen = new Set<string>();
  let completed = 0;
  for (const candidate of candidates) {
    progress?.(completed++, candidates.length);
    let { name, website, email, source } = candidate;
    if (!email && website) {
      try { const result = await collectBusinessWebsite(website, reader); name ||= result.name; website = result.website; if (result.found[0]) { email = result.found[0].email; source = result.found[0].source; } }
      catch { warnings.push(`${name || website}: emailul public nu a putut fi verificat.`); }
    }
    if (!name || (!email && !website)) continue;
    const identity = email || website; if (seen.has(identity)) continue; seen.add(identity);
    try { contacts.push(normalizeMarketingInput({ name, website, email, city, category: b.category, source, phone: candidate.phone, consent: 'not_recorded', notes: `Colectare publică ${new Date().toISOString().slice(0, 10)}. Localitatea și categoria necesită verificare. Sursa inițială: ${candidate.source}. Publicarea emailului nu reprezintă acord pentru marketing.` })); }
    catch { warnings.push(`${name}: datele publice necesită completare manuală.`); }
  }
  progress?.(candidates.length, candidates.length);
  return { contacts, requested: candidates.length, excluded: candidates.length - contacts.length, notFound: 0, warnings, attribution: supplied.length ? 'Site-uri publice ale firmelor' : '© OpenStreetMap contributors · ODbL', collectionSource: supplied.length ? 'websites' : 'openstreetmap' };
}
