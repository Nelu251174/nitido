import {describe,expect,it} from 'vitest';
import {load,type CheerioAPI} from 'cheerio';
import {performance} from 'node:perf_hooks';
import {extractBusinessPage,marketingVisibleText} from './adminMarketingWebCollection';

// Retain the old text ordering: each element's direct text precedes its
// descendants' text. Changing it also changes stored content fingerprints.
function previousText($:CheerioAPI,selector:string){
 return $(selector).find('*').addBack().contents().filter((_,node)=>node.type==='text').map((_,node)=>node.type==='text'?node.data:'').get().join(' ');
}

describe('public page text extraction',()=>{
 it('preserves ordering and spacing across nested and overlapping selectors',()=>{
  for(let i=0;i<40;i++){
   const $=load(`<html><head><style>style-${i}</style></head><body>lead<!--comment--><div id="root">before<p>alpha-${i}<b>bold</b>after</p>between<span>office@fixture.example</span>end<script>script-${i}</script></div>tail</body></html>`);
   for(const selector of ['body','#root','#root,p','p,span','*','head,body','.missing']){
    expect(marketingVisibleText($,selector)).toBe(previousText($,selector));
   }
  }
 });

 it('keeps large permitted pages well inside the HTTP healthcheck timeout',()=>{
  const html='<body>'+Array.from({length:20000},(_,i)=>`<span>text-${i}</span>`).join('')+'</body>';
  expect(Buffer.byteLength(html)).toBeLessThan(700000);
  const $=load(html),start=performance.now();
  const text=marketingVisibleText($,'body');
  expect(text.split(' ')).toHaveLength(20000);
  expect(text.startsWith('text-0 text-1 ')).toBe(true);
  expect(text.endsWith('text-19999')).toBe(true);
  expect(performance.now()-start).toBeLessThan(1500);
 });

 it('deduplicates resolved links while retaining first-seen order and limits',()=>{
  const html='<title>Fixture</title><body><a href="/contact/b">contact</a><a href="https://fixture.example/contact/b#duplicate">contact</a><a href="/contact/a">contact</a><a href="https://other.example/contact">contact</a><a href="/about">about</a></body>';
  const all=extractBusinessPage(html,'https://fixture.example/',Infinity);
  expect(all.links).toEqual(['https://fixture.example/contact/b','https://fixture.example/contact/a','https://fixture.example/about']);
  expect(extractBusinessPage(html,'https://fixture.example/',2)).toEqual({...all,links:all.links.slice(0,2)});
 });
});
