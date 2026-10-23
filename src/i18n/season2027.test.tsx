import React from 'react';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {renderToStaticMarkup} from 'react-dom/server';
import {NextIntlClientProvider} from 'next-intl';
import {it,expect} from 'vitest';
import {NewFeatures} from '@/components/NewFeatures';
import {textKey} from './text';
import scope from '../../messages/season-2027-source.json';
import manifest from '../../messages/manifest.json';

for(const locale of manifest.locales){
 it(`delivers every new feature card and selected operational controls in ${locale}`,()=>{
  const catalog=JSON.parse(readFileSync(resolve('messages',locale+'.json'),'utf8')) as Record<string,string>;
  for(const text of scope){expect(catalog[textKey(text)],`${locale}: ${text}`).toBeTruthy();if(locale!=='ro')expect(catalog[textKey(text)]).not.toBe(text);}
  const html=renderToStaticMarkup(<NextIntlClientProvider locale={locale} timeZone="Europe/Bucharest" messages={{ui:catalog}}><NewFeatures/></NextIntlClientProvider>);
  expect(html).toContain(catalog[textKey(scope[0])]);
  // Booking links stay identical across locales; translations never change routing.
  for(const href of ['/pentru-cei-dragi','/client/planul-casei','/client/pregatire-oaspeti','/client/rutina','/intervale-libere','/client/descrie-prin-poze'])expect(html).toContain(`href="${href}"`);
  const badgeHtml=renderToStaticMarkup(<span>{catalog[textKey('NEW')]}</span>).slice(6,-7);
  expect(html.split(`>${badgeHtml}<`).length-1).toBe(10);
 });
}
