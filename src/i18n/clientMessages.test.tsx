import {describe, it, expect} from 'vitest';
import {createElement as h} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {NextIntlClientProvider} from 'next-intl';
import source from '../../messages/ro.json';
import french from '../../messages/fr.json';
import {clientMessages} from './clientMessages';
import {textKey, translateText} from './text';
import {UiText, UiTemplate, UiElement} from '@/components/UiText';

describe('source-language client payload', () => {
  it('omits the duplicate Romanian catalog while preserving every published source message', () => {
    const result = clientMessages('ro', {ui: source});
    expect(result.ui).toEqual({});
    expect(JSON.stringify(result).length).toBeLessThan(50);
    for (const text of Object.values(source)) {
      expect(translateText(result.ui, text)).toBe(translateText(source, text));
      expect(translateText(result.ui, ` ${text} `)).toBe(translateText(source, ` ${text} `));
    }
    expect(Object.keys(source)).toHaveLength(5766);
  });

  it('preserves explicit Romanian corrections and keeps foreign catalogs intact', () => {
    const ui = {...source, [textKey('Text sursă')]: 'Text corectat'};
    expect(clientMessages('ro', {ui}).ui).toEqual({[textKey('Text sursă')]: 'Text corectat'});
    const foreign = {ui: french};
    expect(clientMessages('fr', foreign)).toBe(foreign);
    expect(clientMessages('en', foreign)).toBe(foreign);
  });

  it('does not share country or money context between visitors using the same catalog', () => {
    const ron = {ui: source, displayCurrency: {country:'RO', currency:'RON', eurRon:'', rateDate:''}};
    const eur = {ui: source, displayCurrency: {country:'ES', currency:'EUR', eurRon:'5.3443', rateDate:'2026-11-04'}};
    const a = clientMessages('ro', ron), b = clientMessages('ro', eur);
    expect(a.ui).toBe(b.ui);
    expect(a.displayCurrency).toBe(ron.displayCurrency);
    expect(b.displayCurrency).toBe(eur.displayCurrency);
    expect(a.displayCurrency.country).toBe('RO');
    expect(b.displayCurrency.currency).toBe('EUR');
    expect(ron.ui).toBe(source);
  });

  it('renders identical Romanian form copy, placeholders, templates and money', () => {
    const child = h('div', {}, h(UiText, {text:'Autentificare'}),
      h(UiElement, {as:'input', placeholder:'Parolă', value:' Nume privat ', readOnly:true}),
      h(UiTemplate, {text:'Confirmă {p0} pentru {p1}', values:['500 RON', '<Ana>']}),
      h(UiText, {text:'500 lei'}));
    for (const displayCurrency of [{country:'RO',currency:'RON',eurRon:'',rateDate:''}, {country:'ES',currency:'EUR',eurRon:'5.3443',rateDate:'2026-11-04'}]) {
      const messages = {ui:source, displayCurrency};
      const render = (m: typeof messages) => renderToStaticMarkup(h(NextIntlClientProvider, {locale:'ro', messages:m, timeZone:'Europe/Bucharest', children:child}));
      expect(render(clientMessages('ro', messages))).toBe(render(messages));
    }
    expect(translateText(clientMessages('ro', {ui:source}).ui, ' Text  necunoscut ')).toBe(' Text  necunoscut ');
  });
});
