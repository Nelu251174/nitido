import {describe,it,expect} from 'vitest';
import {parseDirectoryCategory,parseDirectoryIndex,parseDirectoryListing,parseDirectoryProfile} from './adminMarketingDirectory';
const base='https://www.ghidul.ro/firme-servicii-diverse/curatenie-servicii/';
const listing=(county='Constanta')=>`<body>1 firme<table class="rubrica_firma"><tr><td class="firme_denumire"><a class="inscriere_titlu" href="https://www.ghidul.ro/firm/">Firm</a></td></tr><tr><td><table><tr><td><span class="firma_txt">Firma</span></td><td>|</td><td>${county}</td><td>Afisari: 20</td></tr></table></td></tr></table><ul class="all_pages"><li><a href="${base}constanta/pag-2/">2</a></li><li><a href="${base}bucuresti/pag-2/">wrong county</a></li></ul></body>`;
describe('public business directory completeness and geography',()=>{
 it('takes every category without a total cap and excludes the public administration chapter',()=>{const html=Array.from({length:550},(_,i)=>`<a href="/firme-comert/category-${i}/">Category</a>`).join('')+'<a href="/firme-servicii-publice/politia/">Public</a>';expect(parseDirectoryIndex(html)).toHaveLength(550);expect(()=>parseDirectoryIndex('<body>temporarily unavailable</body>')).toThrow();});
 it('only follows an actual county link, never treating national results as county businesses',()=>{expect(parseDirectoryCategory(`<a href="${base}constanta/">Constanta</a>`,base,'CT')).toBe(base+'constanta/');expect(parseDirectoryCategory(`<a href="${base}bucuresti/">Bucuresti</a>`,base,'CT')).toBeUndefined();expect(parseDirectoryCategory(`<a href="${base}dimbovita/">Dimbovita</a>`,base,'CT')).toBeUndefined();expect(()=>parseDirectoryCategory('<body>broken</body>',base,'CT')).toThrow();});
 it('follows all same-county pagination and checks the county in each business row',()=>{expect(parseDirectoryListing(listing(),base+'constanta/','CT')).toEqual({profiles:[{url:'https://www.ghidul.ro/firm/',name:'Firm'}],pages:[base+'constanta/pag-2/']});expect(()=>parseDirectoryListing(listing('Ilfov'),base+'constanta/','CT')).toThrow();});
 it('rejects silently truncated listings and missing company profile identity',()=>{expect(()=>parseDirectoryListing(listing().replace('1 firme','100 firme').replace(/<ul[\s\S]*<\/ul>/,''),base+'constanta/','CT')).toThrow();expect(()=>parseDirectoryProfile('<body>Email provider@other.ro</body>','https://www.ghidul.ro/firm/','CT')).toThrow();});
 it('collects all visible business addresses while excluding page scripts and unrelated footer/forms',()=>{const r=parseDirectoryProfile('<body><div id="td_continut"><span id="span_left_nume">Public firm</span><a href="mailto:office@firm.ro">Office</a><p>info@firm.ro</p><a href="https://firm.ro">www.firm.ro</a><form>provider@other.ro</form><script>script@other.ro</script></div><footer>footer@other.ro</footer></body>','https://www.ghidul.ro/firm/','CT');expect(r.emails).toEqual(['info@firm.ro','office@firm.ro']);expect(r.city).toBe('Localitate neprecizată');expect(r.website).toBe('https://firm.ro/');});
});

describe('shared catalog table regression',()=>{
 const firm=(id:string,county:string)=>`<tr><td><a class="inscriere_titlu" href="https://www.ghidul.ro/${id}/">Synthetic ${id}</a></td></tr><tr><td>Separator</td></tr><tr><td><table><tr><td><span class="firma_txt">Firma</span></td><td>|</td><td>${county}</td><td>Afisari: 20</td></tr></table></td></tr>`;
 const shared=(rows:string,count:number)=>`<body>${count} firme<table class="rubrica_firma"><tbody>${rows}</tbody></table></body>`;
 it('reads all nine titles and their county metadata from one shared table, as on the real CT audit listing',()=>{
  const html=shared(Array.from({length:9},(_,i)=>firm('firm'+i,'Constanta')).join(''),9);
  const parsed=parseDirectoryListing(html,base+'constanta/','CT');expect(parsed.profiles).toHaveLength(9);expect(new Set(parsed.profiles.map(p=>p.url)).size).toBe(9);expect(parsed.pages).toEqual([]);
 });
 it('counts all listing rows when validating completeness and only saves rows from the selected county',()=>{
  expect(parseDirectoryListing(shared(firm('ct','Constanta')+firm('b','Bucuresti'),2),base+'constanta/','CT').profiles.map(p=>p.url)).toEqual(['https://www.ghidul.ro/ct/']);
 });
 it('keeps București profiles separate from Ilfov even when the catalog table mixes both',()=>{
  expect(parseDirectoryListing(shared(firm('b','Bucuresti')+firm('if','Ilfov'),2),base+'bucuresti/','B').profiles.map(p=>p.url)).toEqual(['https://www.ghidul.ro/b/']);
 });
 it('queues an empty listing title only when its profile URL and county are verified; identity is required on the profile',()=>{
  const html=shared(firm('empty-title','Bucuresti').replace('Synthetic empty-title','')+firm('if','Ilfov'),2);
  expect(parseDirectoryListing(html,base+'bucuresti/','B').profiles).toEqual([{url:'https://www.ghidul.ro/empty-title/',name:''}]);
  expect(()=>parseDirectoryListing(html.replace('https://www.ghidul.ro/empty-title/','https://outside.example/firm/'),base+'bucuresti/','B')).toThrow();
  expect(()=>parseDirectoryProfile('<div id="td_continut">office@firm.ro</div>','https://www.ghidul.ro/empty-title/','B')).toThrow();
 });
 it('does not take metadata from the next business when the current row is incomplete',()=>{
  const html=shared('<tr><td><a class="inscriere_titlu" href="https://www.ghidul.ro/missing/">Missing metadata</a></td></tr>'+firm('ct','Constanta'),2);
  expect(()=>parseDirectoryListing(html,base+'constanta/','CT')).toThrow('incomplete');
 });
});
