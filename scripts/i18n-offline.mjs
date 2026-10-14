import fs from 'node:fs';
const manifest=JSON.parse(fs.readFileSync('messages/manifest.json','utf8'));
const languages=manifest.locales;
const source={heading:'Conexiune indisponibilă',message:'Conexiunea s-a întrerupt. Reîncearcă.',retry:'Reîncearcă'};
function key(text){let a=0x811c9dc5,b=0x9e3779b9;for(const c of text.replace(/\s+/g,' ').trim()){const cp=c.codePointAt(0);a=Math.imul(a^cp,0x01000193);b=Math.imul(b^cp,0x85ebca6b);}return `t${(a>>>0).toString(16)}_${(b>>>0).toString(16)}`;}
if(!manifest.complete||!Array.isArray(languages)||languages.length!==manifest.languages||!languages.includes('ro'))throw Error('Validated complete released catalogs are required for offline copy');
const copy=Object.fromEntries(languages.map(locale=>{const catalog=JSON.parse(fs.readFileSync(`messages/${locale}.json`,'utf8'));return [locale,Object.fromEntries(Object.entries(source).map(([name,text])=>{const value=catalog[key(text)];if(typeof value!=='string'||!value.trim())throw Error('Missing offline copy '+locale+'/'+name);return [name,value]}))]}));
const serialized=JSON.stringify(copy).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
const html=fs.readFileSync('public/offline.html','utf8');
const style=html.match(/<style>[\s\S]*?<\/style>/)?.[0];if(!style)throw Error('Offline styles are missing');
const escape=value=>value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const generated=`<!doctype html>
<html lang="ro"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(copy.ro.heading)} — NITIDO.RO</title>${style}</head>
<body><div class="card"><div class="logo">NITIDO<span>.RO</span></div><h1 id="heading">${escape(copy.ro.heading)}</h1><p id="message">${escape(copy.ro.message)}</p><a id="retry" href="/" onclick="location.reload();return false;">${escape(copy.ro.retry)}</a></div>
<script>
(function(){
 const copy=${serialized};
 const supported=value=>{const code=String(value||'').trim().toLowerCase().replace(/_/g,'-').split('-')[0];return Object.prototype.hasOwnProperty.call(copy,code)?code:null;};
 let manual=null,cached=null;try{const cookie=document.cookie.match(/(?:^|;\\s*)nitido-language=([^;]+)/);manual=cookie?supported(decodeURIComponent(cookie[1])):null;cached=supported(localStorage.getItem('nitido-last-language'));}catch{}
 const locale=manual||(navigator.languages||[navigator.language]).map(supported).find(Boolean)||cached||'ro';
 document.documentElement.lang=locale;document.title=copy[locale].heading+' — NITIDO.RO';
 for(const name of ['heading','message','retry'])document.getElementById(name).textContent=copy[locale][name];
})();
</script></body></html>
`;
if(process.argv.includes('--check')){
 if(html!==generated)throw Error('Regenerate offline copy with node scripts/i18n-offline.mjs');
}else fs.writeFileSync('public/offline.html',generated);
console.log(JSON.stringify({offlineLanguages:languages.length,messagesPerLanguage:3}));
