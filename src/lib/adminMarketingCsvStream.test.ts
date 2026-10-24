import {describe,it,expect} from 'vitest';
import {marketingCsvBatches} from './adminMarketingCsvStream';
import {parseMarketingCsv} from './adminMarketing';
async function* chunks(s:string,n=13){for(let i=0;i<s.length;i+=n)yield s.slice(i,i+n);}
describe('CSV volume without total ceiling',()=>{
 it('streams 100001 rows including CRLF, escaped quotes and multiline notes across chunk boundaries',async()=>{
  const header='name,category,email,county,city,source,notes\r\n';let n=0,batches=0;
  async function* input(){yield header;for(let i=0;i<100001;i++)yield `"Firma ""${i}""",business,f${i}@synthetic.ro,CT,Mangalia,Public,"line1\nline2"\r\n`;}
  for await(const csv of marketingCsvBatches(input())){const rows=parseMarketingCsv(csv);expect(rows.length).toBeLessThanOrEqual(200);n+=rows.length;batches++;if(batches===1)expect(rows[0]).toMatchObject({county:'Constanța',notes:'line1\nline2'});}
  expect(n).toBe(100001);expect(batches).toBe(501);
 },30000);
 it('preserves quoted newlines and escaped quotes split into tiny chunks',async()=>{let result='';for await(const csv of marketingCsvBatches(chunks('name;category;email;city;source;notes\r\n"a; ""b""";business;a@firm.ro;Mangalia;Public;"line1\r\nline2"\r\n',1)))result=csv;expect(parseMarketingCsv(result)[0]).toMatchObject({name:'a; "b"',notes:'line1\r\nline2'});});
 it('rejects incomplete quoting instead of silently dropping the last row',async()=>{await expect(async()=>{for await(const csv of marketingCsvBatches(chunks('name,category\na,"bad')))void csv;}).rejects.toThrow('neînchise');});
});
