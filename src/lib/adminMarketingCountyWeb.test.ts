import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import Database from 'better-sqlite3';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {collectMarketingCountyWebsite,initializeMarketingCountyWeb} from './adminMarketingCountyWeb';
import type {PublicReader} from './adminMarketingPublicWeb';
const page=(url:string,text:string,status=200,headers:Record<string,string>={})=>({url,text,status,headers:{'content-type':url.endsWith('robots.txt')?'text/plain':'text/html',...headers}});
let db:Database.Database;
function setup(file=':memory:'){const d=new Database(file);d.exec("CREATE TABLE IF NOT EXISTS marketing_county_sites(job_id TEXT,website TEXT,result TEXT,warning TEXT,PRIMARY KEY(job_id,website))");initializeMarketingCountyWeb(d);return d;}
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-25T03:00:00Z'));db=setup();});
afterEach(()=>{db.close();vi.useRealTimers();});
async function drain(website:string,reader:PublicReader,limit=60){let r;for(let i=0;i<limit;i++){r=await collectMarketingCountyWebsite(db,'job',website,reader,()=>true);if(r.complete)return r;vi.setSystemTime(Math.max(Date.now()+3000,Date.parse(r.nextAttemptAt??'')||0));}throw Error('Frontier did not finish');}
describe('persistent county public contact pages',()=>{
 it('stops expanding repeated relative contact paths only after matching the page content',async()=>{
  const reader=vi.fn<PublicReader>(async url=>page(url,url.endsWith('robots.txt')?'':'<p>office@firm.ro</p><a href="contact/">Contact</a><script>nonce'+Math.random()+'</script>'));
  const result=await drain('https://firm.ro/',reader);expect(result.found.map(f=>f.email)).toEqual(['office@firm.ro']);
  expect(db.prepare("SELECT COUNT(*) n FROM marketing_county_web_pages WHERE reason='DUPLICATE_CONTENT_CYCLE'").get()).toEqual({n:1});
  expect(reader.mock.calls.some(([url])=>url.includes('/contact/contact/contact/'))).toBe(false);expect(result.warning).toBe('');
 });
 it('honors a declared public HTML base and still follows repeated path names when content changes',async()=>{
  const baseReader=vi.fn<PublicReader>(async url=>page(url,url.endsWith('robots.txt')?'':'<base href="/"><p>info@base.ro</p><a href="contact/">Contact</a>'));
  await drain('https://base.ro/branch/',baseReader);expect(baseReader.mock.calls.some(([url])=>url==='https://base.ro/contact/')).toBe(true);expect(baseReader.mock.calls.some(([url])=>url.includes('/branch/contact/'))).toBe(false);
  const reader=vi.fn<PublicReader>(async url=>page(url,url.endsWith('robots.txt')?'':new URL(url).pathname==='/about/about/'?'branch@unique.ro':'<p>office@unique.ro</p><a href="'+(new URL(url).pathname==='/'?'/about/':'/about/about/')+'">About</a>'));
  const result=await drain('https://unique.ro/',reader);expect(result.found.map(f=>f.email).sort()).toEqual(['branch@unique.ro','office@unique.ro']);
 });

 it('finds all five linked contact pages, even with an email already on the home page',async()=>{
  const reader:PublicReader=vi.fn(async url=>url.endsWith('robots.txt')?page(url,'User-agent: *\nAllow: /'):new URL(url).pathname==='/'?page(url,'<p>office@firm.ro</p>'+Array.from({length:5},(_,i)=>`<a href="/contact-${i+1}">Contact</a>`).join('')):page(url,`<p>branch${new URL(url).pathname.slice(-1)}@firm.ro</p><a href="/">About home</a>`));
  const r=await drain('https://firm.ro/',reader);expect(r.found).toHaveLength(6);expect(r.warning).toBe('');expect(db.prepare("SELECT COUNT(*) n FROM marketing_county_web_pages WHERE state='done'").get()).toEqual({n:6});
 });
 it('resumes persisted pages after reopening the database without re-reading completed pages',async()=>{
  const root=mkdtempSync(join(tmpdir(),'marketing-web-pages-')),file=join(root,'synthetic.db');db.close();db=setup(file);
  const reader=vi.fn<PublicReader>(async url=>url.endsWith('robots.txt')?page(url,''):new URL(url).pathname==='/'?page(url,'<a href="/contact">Contact</a>'):page(url,'info@firm.ro'));
  try{await collectMarketingCountyWebsite(db,'job','https://firm.ro/',reader,()=>true);vi.setSystemTime(Date.now()+3000);await collectMarketingCountyWebsite(db,'job','https://firm.ro/',reader,()=>true);db.close();db=setup(file);const r=await drain('https://firm.ro/',reader);expect(r.found.map(f=>f.email)).toEqual(['info@firm.ro']);expect(reader.mock.calls.filter(([url])=>url==='https://firm.ro/')).toHaveLength(1);}finally{db.close();db=setup();rmSync(root,{recursive:true,force:true});}
 });
 it('follows public robots redirects and rechecks rules for a page redirect to the canonical domain',async()=>{
  const reader=vi.fn<PublicReader>(async url=>url==='https://www.firm.ro/robots.txt'?page(url,'',301,{location:'https://firm.ro/robots.txt'}):url.endsWith('robots.txt')?page(url,'User-agent: *\nAllow: /'):url==='https://www.firm.ro/'?page(url,'',301,{location:'https://firm.ro/'}):page(url,'office@firm.ro'));
  const r=await drain('https://www.firm.ro/',reader);expect(r.warning).toBe('');expect(r.found).toEqual([{email:'office@firm.ro',source:'https://firm.ro/'}]);const paths=reader.mock.calls.map(([url])=>url);expect(paths.indexOf('https://firm.ro/robots.txt')).toBeLessThan(paths.indexOf('https://firm.ro/'));
 });
 it('never requests a disallowed contact page and preserves an access refusal as an explicit gap',async()=>{
  const reader=vi.fn<PublicReader>(async url=>url.endsWith('robots.txt')?page(url,'User-agent: *\nDisallow: /private'):page(url,'office@firm.ro<a href="/private/contact">Contact</a>'));
  const r=await drain('https://firm.ro/',reader);expect(r.warning).toContain('ROBOTS_DISALLOWED');expect(reader.mock.calls.some(([url])=>url.includes('/private/contact'))).toBe(false);expect(r.found).toHaveLength(1);
 });
 it('does not retry HTTP 403 or treat an HTML robots fallback as permission',async()=>{
  const denied=vi.fn<PublicReader>(async url=>url.endsWith('robots.txt')?page(url,''):page(url,'Forbidden',403));expect((await drain('https://denied.ro/',denied)).warning).toContain('HTTP_403');await drain('https://denied.ro/',denied);expect(denied.mock.calls.filter(([url])=>url==='https://denied.ro/')).toHaveLength(1);
  const fallback=vi.fn<PublicReader>(async url=>page(url,'<html><body>Home</body></html>'));expect((await drain('https://fallback.ro/',fallback)).warning).toContain('ROBOTS_NOT_TEXT');expect(fallback).toHaveBeenCalledOnce();
 });
 it('persists Retry-After and does not request again before the source deadline',async()=>{
  let count=0;const reader=vi.fn<PublicReader>(async url=>url.endsWith('robots.txt')&&count++===0?page(url,'Unavailable',503,{'retry-after':'1200'}):url.endsWith('robots.txt')?page(url,''):page(url,'office@firm.ro'));
  const start=Date.now(),first=await collectMarketingCountyWebsite(db,'job','https://firm.ro/',reader,()=>true);expect(Date.parse(first.nextAttemptAt!)).toBe(start+1200000);vi.setSystemTime(start+1199000);await collectMarketingCountyWebsite(db,'job','https://firm.ro/',reader,()=>true);expect(reader).toHaveBeenCalledOnce();vi.setSystemTime(start+1200000);expect((await drain('https://firm.ro/',reader)).found).toHaveLength(1);
 });
 it('records redirect cycles and stops without saving response data after a pause',async()=>{
  const cyclic:PublicReader=async url=>url.endsWith('robots.txt')?page(url,''):page(url,'',301,{location:new URL(url).pathname==='/'?'/contact':'/'});expect((await drain('https://cycle.ro/',cyclic)).warning).toContain('PAGE_REDIRECT_LOOP');
  let active=true;const reader:PublicReader=async url=>{if(url.endsWith('robots.txt'))return page(url,'');active=false;return page(url,'office@firm.ro');};await collectMarketingCountyWebsite(db,'job','https://pause.ro/',reader,()=>active);vi.setSystemTime(Date.now()+3000);const r=await collectMarketingCountyWebsite(db,'job','https://pause.ro/',reader,()=>active);expect(r.complete).toBe(false);expect(r.found).toEqual([]);
 });
 it('honors Crawl-delay before fetching the root page',async()=>{
  const reader=vi.fn<PublicReader>(async url=>url.endsWith('robots.txt')?page(url,'User-agent: *\nCrawl-delay: 20'):page(url,'office@firm.ro'));
  const start=Date.now(),first=await collectMarketingCountyWebsite(db,'job','https://firm.ro/',reader,()=>true);expect(Date.parse(first.nextAttemptAt!)).toBe(start+20000);
  vi.setSystemTime(start+19000);await collectMarketingCountyWebsite(db,'job','https://firm.ro/',reader,()=>true);expect(reader).toHaveBeenCalledOnce();vi.setSystemTime(start+20000);expect((await drain('https://firm.ro/',reader)).found).toHaveLength(1);
 });

});
