import {describe,it,expect,vi} from 'vitest';
import {createElement as h,type ReactNode} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {NextIntlClientProvider} from 'next-intl';
import {textKey} from './text';
import {RatingEntry} from '@/components/RatingEntry';
import {VerifiedReviews} from '@/components/VerifiedReviews';
vi.mock('@/components/ReviewEntryLink',()=>({ReviewEntryLink:({children,href}:{children:ReactNode;href:string})=><a href={href}>{children}</a>}));

const pairs=[
 ['☆ Rating și evaluări','☆ Ratings and reviews'],
 ['Rating și evaluări','Ratings and reviews'],
 ['Nu există încă recenzii verificate.','There are no verified reviews yet.'],
 ['Firme și servicii prin NITIDO','Companies and services through NITIDO'],
 ['Vezi recenziile','See reviews'],['Evaluează lucrarea','Review the service'],
 ['{p0} din 5 stele','{p0} out of 5 stars'],['Lucrare verificată','Verified service'],
 ['Firma Curată','Never translate user company names'],
 ['Curățenie excelentă.','Never translate user review text'],
];
const ui=Object.fromEntries(pairs.map(([source,target])=>[textKey(source),target]));
const render=(child:ReactNode)=>renderToStaticMarkup(h(NextIntlClientProvider,{locale:'en',messages:{ui},timeZone:'Europe/Bucharest',children:child}));
describe('new review copy is wired to the selected catalog',()=>{
 it('translates rating controls and the empty state',()=>{
  const html=render(<RatingEntry count={0} average={null}/>);
  for(const text of ['Ratings and reviews','There are no verified reviews yet.','See reviews','Review the service'])expect(html).toContain(text);
  expect(html).not.toContain('Nu există încă');
 });
 it('translates accessible templates and owned badges while keeping customer content intact',()=>{
  const html=render(<VerifiedReviews reviews={[{id:'synthetic-review',firmName:'Firma Curată',rating:4,reviewText:'Curățenie excelentă.',reviewer:'Ana Popescu',badge:'Lucrare verificată',createdAt:'2026-10-23T12:00:00Z'}]}/>);
  expect(html).toContain('aria-label="4 out of 5 stars"');
  expect(html).toContain('Verified service');
  expect(html).toContain('Firma Curată');expect(html).toContain('Curățenie excelentă.');
  expect(html).not.toContain('Never translate user');
 });
});
