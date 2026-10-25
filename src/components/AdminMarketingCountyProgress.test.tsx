import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {AdminMarketingCountyProgress} from './AdminMarketingCountyProgress';
import type {MarketingCountySummary} from '@/lib/adminMarketingCountyShared';
const job:NonNullable<MarketingCountySummary['job']>={id:'B',state:'importing',imported:5000,total:14001,processed:0,withoutEmail:0,warnings:0,message:'',updatedAt:'',nextAttemptAt:null};
describe('Market county import progress',()=>{
 it('shows imported firms before any email has been collected, with the import count driving the progress bar',()=>{
  const html=renderToStaticMarkup(<AdminMarketingCountyProgress name="București" job={job}/>);
  expect(html).toContain('5.000 / 14.001 firme');expect(html).toContain('value="5000"');expect(html).toContain('Importul este în curs');expect(html).not.toContain('Firme procesate: 0');
 });
 it('explains source preparation without showing an empty collection bar',()=>{
  const html=renderToStaticMarkup(<AdminMarketingCountyProgress name="București" job={{...job,state:'preparing',total:0,imported:0}}/>);
  expect(html).toContain('Se pregătește inventarul public pentru București');expect(html).toContain('Emailurile vor apărea după import');expect(html).not.toContain('<progress');
 });
});
