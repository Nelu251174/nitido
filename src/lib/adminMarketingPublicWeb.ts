import { request, Agent } from 'node:https';
import { lookup } from 'node:dns/promises';
import type { LookupAddress } from 'node:dns';
import { isIP } from 'node:net';
import { HttpsProxyAgent } from 'https-proxy-agent';
import ipaddr from 'ipaddr.js';
import { createBrotliDecompress, createGunzip, createInflate } from 'node:zlib';
import type { IncomingHttpHeaders } from 'node:http';
import { MarketingError } from './adminMarketing';

export type PublicPage = { status: number; headers: IncomingHttpHeaders; text: string; url: string };
export type PublicReader = (url: string, options?: { method?: 'GET' | 'POST'; body?: string; maxBytes?: number; timeoutMs?: number; redirects?: boolean }) => Promise<PublicPage>;
export function publicWebsite(value: string): URL {
  let url: URL;
  try { url = new URL(value); } catch { throw new MarketingError('Adresă publică invalidă.'); }
  if (url.protocol === 'http:') url.protocol = 'https:';
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || !hostname.includes('.') || isIP(hostname.replace(/^\[|\]$/g, '')) || /(^|\.)(localhost|local|internal|lan|invalid|test|home|onion)$/.test(hostname)) throw new MarketingError('Colectarea acceptă numai site-uri HTTPS publice, fără autentificare sau porturi speciale.');
  url.hostname = hostname; url.hash = ''; return url;
}
export function isPublicAddress(address: string): boolean {
  try { const ip = ipaddr.process(address); return ip.range() === 'unicast'; } catch { return false; }
}
export function optionsAllLookup(options: {all?:boolean}, addresses: LookupAddress[], callback: (error:NodeJS.ErrnoException|null,address:string|LookupAddress[],family?:number)=>void) {
  if(options.all)callback(null,addresses);else callback(null,addresses[0].address,addresses[0].family);
}
/** Bounded HTTPS reads. Direct connections pin the checked DNS answer; configured proxies are preserved. */
export const readPublicPage: PublicReader = async (raw, options = {}) => {
  let url = publicWebsite(raw); const maxBytes = options.maxBytes ?? 700000;
  for (let hop = 0; hop <= 3; hop++) {
    const addresses = await new Promise<LookupAddress[]>((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('PUBLIC_DNS_TIMEOUT')),8000);timer.unref();
      lookup(url.hostname,{all:true,verbatim:true}).then(value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);});
    });
    if (!addresses.length || addresses.some(item => !isPublicAddress(item.address))) throw new MarketingError('Destinația nu este o adresă publică permisă.');
    const proxy = process.env.HTTPS_PROXY ?? process.env.https_proxy;
    const agent = proxy ? new HttpsProxyAgent(proxy) : new Agent({ lookup: (_host, _options, callback) => optionsAllLookup(_options,addresses,callback) });
    // HTTPS forwards these socket options to TLS/net; keep both validated families available.
    const connectionOptions = { autoSelectFamily: true, autoSelectFamilyAttemptTimeout: 250 };
    const current = url;
    let page: PublicPage;
    try {
      page = await new Promise<PublicPage>((resolve, reject) => {
        const req = request(current, { agent, ...connectionOptions, method: options.method ?? 'GET', signal: AbortSignal.timeout(options.timeoutMs ?? 8000), maxHeaderSize: 16384, headers: { 'User-Agent': 'NITIDO-Marketing/1.0 (+https://nitido.ro/contact)', Accept: 'text/html,application/json,text/plain;q=0.9', 'Accept-Encoding': 'identity', ...(options.body ? { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(options.body) } : {}) } }, response => {
          let rawSize = 0; response.on('data', chunk => { rawSize += chunk.length; if (rawSize > maxBytes) response.destroy(Error('PUBLIC_PAGE_TOO_LARGE')); });
          const encoding = String(response.headers['content-encoding'] ?? 'identity');
          const stream = encoding === 'gzip' ? response.pipe(createGunzip()) : encoding === 'br' ? response.pipe(createBrotliDecompress()) : encoding === 'deflate' ? response.pipe(createInflate()) : response;
          const chunks: Buffer[] = []; let size = 0;
          stream.on('data', chunk => { size += chunk.length; if (size > maxBytes) { stream.destroy(Error('PUBLIC_PAGE_TOO_LARGE')); response.destroy(); } else chunks.push(Buffer.from(chunk)); });
          stream.on('error', reject); response.on('error', reject);
          stream.on('end', () => resolve({ status: response.statusCode ?? 502, headers: response.headers, text: Buffer.concat(chunks).toString('utf8'), url: current.href }));
        });
        req.setTimeout(options.timeoutMs ?? 8000, () => req.destroy(Error('PUBLIC_PAGE_TIMEOUT'))); req.on('error', reject);
        if (options.body) req.write(options.body); req.end();
      });
    } finally { agent.destroy(); }
    if ([301, 302, 303, 307, 308].includes(page.status) && page.headers.location) {
      if (options.redirects === false) return page;
      if (options.method === 'POST') throw new MarketingError('Sursa publică a redirecționat cererea; încearcă mai târziu.', 502);
      url = publicWebsite(new URL(page.headers.location, current).href); continue;
    }
    return page;
  }
  throw new MarketingError('Prea multe redirecționări pentru site-ul firmei.', 502);
};
