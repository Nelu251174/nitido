import {describe,it,expect} from 'vitest';
import {createElement as h} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {NextIntlClientProvider} from 'next-intl';
import {LANGUAGES,asLocale,selectLocale,hasSupportedLanguage} from './locales';
import {textKey,translateText} from './text';
import {UiText,UiTemplate,UiElement} from '@/components/UiText';
import source from '../../messages/ro.json';

describe('language negotiation',()=>{
  it('recognizes all 24 EU languages and regional/device tags',()=>{
    expect(new Set(LANGUAGES.map(([code])=>code)).size).toBe(24);
    for(const [locale] of LANGUAGES)expect(asLocale(`${locale.toUpperCase()}-EU`)).toBe(locale);
    expect(asLocale('../../en')).toBeUndefined();
    expect(asLocale('ru')).toBeUndefined();
  });
  it('gives a manual preference priority over device language and country',()=>{
    expect(selectLocale('ga','fr-FR,en;q=0.8','DE')).toBe('ga');
    expect(selectLocale('invalid','fr-FR,en;q=0.8','DE')).toBe('fr');
  });
  it('respects q weights, q=0 and malformed preferences',()=>{
    expect(selectLocale(null,'fr;q=0,en-US;q=0.6,de;q=0.9','FR')).toBe('de');
    expect(selectLocale(null,'fr;q=oops,en;q=1.2,sv;q=0.8','FR')).toBe('sv');
    expect(selectLocale(null,'ja-JP,fr;q=0','FR')).toBe('fr');
    expect(hasSupportedLanguage('ja-JP,fr;q=0')).toBe(false);
  });
  it('uses IP country only as fallback and does not guess in multilingual countries',()=>{
    expect(selectLocale(null,'en-GB','FR')).toBe('en');
    expect(selectLocale(null,'ja-JP','FR')).toBe('fr');
    expect(selectLocale(null,null,'BE')).toBe('ro');
    expect(selectLocale(null,null,'IE')).toBe('en');
  });
});

const en={
  [textKey('Autentificare')]:'Sign in',
  [textKey('Parolă')]:'Password',
  [textKey('Confirmă {p0} pentru {p1}')]: 'For {p1}, confirm {p0}',
};
const fr={...en,[textKey('Autentificare')]:'Connexion'};
const render=(locale:string,ui:Record<string,string>,child:ReturnType<typeof h>)=>renderToStaticMarkup(h(NextIntlClientProvider,{locale,messages:{ui},timeZone:'Europe/Bucharest',children:child}));
describe('source-owned UI and user data isolation',()=>{
  it('renders separate request catalogs without cross-user language leakage',()=>{
    const child=h(UiText,{text:'Autentificare'});
    expect(render('en',en,child)).toBe('Sign in');
    expect(render('fr',fr,child)).toBe('Connexion');
    expect(render('ro',source,child)).toBe('Autentificare');
    expect(render('en',en,child)).toBe('Sign in');
  });
  it('localizes accessibility/placeholder copy while preserving form value, name and user text',()=>{
    const child=h('div',{},h(UiElement,{as:'input',name:'password',type:'password',value:'Parolă',placeholder:'Parolă','aria-label':'Parolă',readOnly:true}),h('p',{},'Autentificare'));
    const html=render('en',en,child);
    expect(html).toContain('placeholder="Password"');
    expect(html).toContain('aria-label="Password"');
    expect(html).toContain('name="password"');
    expect(html).toContain('value="Parolă"');
    expect(html).toContain('<p>Autentificare</p>');
  });
  it('reorders interpolation slots without translating names, amounts or HTML values',()=>{
    const html=render('en',en,h(UiTemplate,{text:'Confirmă {p0} pentru {p1}',values:['500 RON','<Ion & Ana>']}));
    expect(html).toBe('For &lt;Ion &amp; Ana&gt;, confirm 500 RON');
  });
  it('retains adjacent fragment spaces and returns unknown copy unchanged',()=>{
    expect(translateText(en,' Autentificare ')).toBe(' Sign in ');
    expect(translateText(en,'Ana Popescu')).toBe('Ana Popescu');
  });
  it('keeps source catalog keys stable and free of collisions',()=>{
    for(const [key,text] of Object.entries(source))expect(textKey(text)).toBe(key);
  });
});
