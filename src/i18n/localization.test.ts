import {describe,it,expect} from 'vitest';
import {createElement as h} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {NextIntlClientProvider} from 'next-intl';
import {ALL_EU_LANGUAGES,LANGUAGES,asLocale,selectLocale,hasSupportedLanguage} from './locales';
import {textKey,translateText,translateTemplate} from './text';
import {UiText,UiTemplate,UiElement} from '@/components/UiText';
import {UiDate} from '@/components/UiDate';
import source from '../../messages/ro.json';

describe('language negotiation',()=>{
  it('exposes only the nine complete languages and accepts their regional/device tags',()=>{
    expect(new Set(ALL_EU_LANGUAGES.map(([code])=>code)).size).toBe(24);
    expect(LANGUAGES.map(([code])=>code)).toEqual(['bg','hr','cs','da','nl','en','fr','de','ro']);
    for(const [locale] of LANGUAGES)expect(asLocale(`${locale.toUpperCase()}-EU`)).toBe(locale);
    expect(asLocale('../../en')).toBeUndefined();
    expect(asLocale('ru')).toBeUndefined();
    expect(asLocale('ga-IE')).toBeUndefined();
    expect(selectLocale('it','it-IT,en;q=0.8','IT')).toBe('en');
    expect(selectLocale('it','it-IT','IT')).toBe('ro');
  });
  it('gives a manual preference priority over device language and country',()=>{
    expect(selectLocale('de','fr-FR,en;q=0.8','FR')).toBe('de');
    expect(selectLocale('invalid','fr-FR,en;q=0.8','DE')).toBe('de');
  });
  it('respects q weights, q=0 and malformed preferences',()=>{
    expect(selectLocale(null,'fr;q=0,en-US;q=0.6,de;q=0.9','BE')).toBe('de');
    expect(selectLocale(null,'fr;q=oops,en;q=1.2,da;q=0.8','BE')).toBe('da');
    expect(selectLocale(null,'ja-JP,fr;q=0','FR')).toBe('fr');
    expect(hasSupportedLanguage('ja-JP,fr;q=0')).toBe(false);
  });
  it('uses IP country before browser language and does not guess in multilingual countries',()=>{
    expect(selectLocale(null,'en-US,en;q=0.9','RO')).toBe('ro');
    expect(selectLocale(null,'en-GB','FR')).toBe('fr');
    expect(selectLocale('en','ro-RO','RO')).toBe('en');
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
  it('substitutes server template values only once, including literal placeholder-like user values',()=>{
    expect(translateTemplate(en,'Confirmă {p0} pentru {p1}',['500 RON','{p0}'])).toBe('For {p0}, confirm 500 RON');
  });
  it('formats dates in released languages without changing the operational time zone',()=>{
    const value=new Date('2026-10-14T22:30:00Z'),options={year:'numeric',month:'long',day:'numeric'} as const;
    for(const [locale] of LANGUAGES){
      const html=render(locale,{},h(UiDate,{value,kind:'date',options}));
      expect(html).toBe(renderToStaticMarkup(h('span',{},value.toLocaleDateString(locale,{timeZone:'Europe/Bucharest',...options}))).slice(6,-7));
    }
  });
  it('keeps source catalog keys stable and free of collisions',()=>{
    for(const [key,text] of Object.entries(source))expect(textKey(text)).toBe(key);
  });
});
