import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ platform: 'web' }));
vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => state.platform } }));
import { ADS_CONSENT_KEY, adsAllowed, adsPageLocation, initializeGoogleAds, isAdsPublicPath, readAdsConsent, saveAdsConsent, trackAdsPage, trackCompanySignup } from './googleAds';

let storage: Map<string, string>;
let scripts: { id: string; src: string; async: boolean }[];
let writes: string[];
beforeEach(() => {
  state.platform = 'web'; storage = new Map(); scripts = []; writes = [];
  vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) });
  const document = { head: { appendChild: (script: typeof scripts[number]) => scripts.push(script) }, createElement: () => ({}), getElementById: (id: string) => scripts.find(script => script.id === id) };
  Object.defineProperty(document, 'cookie', { get: () => '_gcl_aw=abc; nitido_session=keep; nitido-language=ro', set: (value: string) => writes.push(value) });
  vi.stubGlobal('document', document);
  vi.stubGlobal('window', { location: { hostname: 'nitido.ro', href: 'https://nitido.ro/signup?role=firma&email=private%40example.test&gclid=click-id' }, dispatchEvent: vi.fn() });
});
afterEach(() => vi.unstubAllGlobals());
const grant = () => saveAdsConsent(true);
const commands = () => (window.dataLayer ?? []).map(command => Array.from(command as ArrayLike<unknown>));

describe('Google Ads consent and registration', () => {
  it('does not load or emit before consent, after refusal, or with a missing or invalid choice', () => {
    initializeGoogleAds('label'); trackAdsPage('/'); expect(trackCompanySignup('firma')).toBe(false);
    expect(scripts).toHaveLength(0); expect(commands()).toEqual([]);
    saveAdsConsent(false); initializeGoogleAds('label'); expect(scripts).toHaveLength(0);
    storage.set(ADS_CONSENT_KEY, '{bad'); expect(readAdsConsent()).toBeNull();
    storage.set(ADS_CONSENT_KEY, JSON.stringify({ allowed: 'yes', savedAt: Date.now() })); expect(readAdsConsent()).toBeNull();
  });
  it('rejects expired and future-dated choices', () => {
    storage.set(ADS_CONSENT_KEY, JSON.stringify({ allowed: true, savedAt: 1 })); expect(readAdsConsent()).toBeNull();
    storage.set(ADS_CONSENT_KEY, JSON.stringify({ allowed: true, savedAt: Date.now() + 10000 })); expect(readAdsConsent()).toBeNull();
  });
  it('sets all denied defaults before config, grants only ad measurement, loads once', () => {
    grant(); initializeGoogleAds(); initializeGoogleAds();
    expect(commands()[0]).toEqual(['consent', 'default', { ad_storage: 'denied', analytics_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' }]);
    expect(commands()[2]).toEqual(['consent', 'update', { ad_storage: 'granted', analytics_storage: 'denied', ad_user_data: 'granted', ad_personalization: 'denied' }]);
    expect(scripts).toHaveLength(1); expect(scripts[0].src).toBe('https://www.googletagmanager.com/gtag/js?id=AW-18344130112');
    expect(commands().filter(command => command[0] === 'config')).toHaveLength(1);
  });
  it('keeps registration dormant without a valid conversion label and excludes client accounts', () => {
    grant(); initializeGoogleAds(); expect(trackCompanySignup('firma')).toBe(false);
    initializeGoogleAds('wrong/label'); expect(trackCompanySignup('firma')).toBe(false);
    initializeGoogleAds('Valid_label-1'); expect(trackCompanySignup('client')).toBe(false);
    expect(trackCompanySignup('firma')).toBe(true);
    const events = commands().filter(command => command[1] === 'conversion');
    expect(events).toHaveLength(1); expect(events[0][2]).toMatchObject({ send_to: 'AW-18344130112/Valid_label-1' });
    expect(JSON.stringify(events)).not.toMatch(/private|@|role=/);
  });
  it('never forwards arbitrary query parameters, title, fragment or referrer', () => {
    expect(adsPageLocation()).toBe('https://nitido.ro/signup?gclid=click-id');
    grant(); initializeGoogleAds('label'); trackAdsPage('/signup');
    const page = commands().find(command => command[1] === 'page_view');
    expect(page?.[2]).toMatchObject({ page_title: 'NITIDO', page_referrer: '' });
    expect(JSON.stringify(commands())).not.toMatch(/private|role=/);
  });
  it('does not send page events for account, admin or API pages', () => {
    grant(); initializeGoogleAds('label');
    for (const path of ['/admin', '/admin/tasks', '/client', '/firma/mesaje', '/api/auth/signup', '/login']) {
      expect(isAdsPublicPath(path)).toBe(false); trackAdsPage(path);
    }
    expect(commands().filter(command => command[1] === 'page_view')).toHaveLength(0);
  });
  it('keeps Google Ads absent in native apps and on sandbox or other domains', () => {
    grant(); state.platform = 'ios'; initializeGoogleAds('label'); expect(adsAllowed()).toBe(false);
    state.platform = 'android'; initializeGoogleAds('label'); expect(adsAllowed()).toBe(false);
    state.platform = 'web'; window.location.hostname = 'sandbox.nitido.ro'; initializeGoogleAds('label'); expect(adsAllowed()).toBe(false);
    expect(scripts).toHaveLength(0); expect(commands()).toEqual([]);
  });
  it('withdraws consent, blocks subsequent events and removes only Ads cookies', () => {
    grant(); initializeGoogleAds('label'); saveAdsConsent(false);
    expect(adsAllowed()).toBe(false); expect(trackCompanySignup('firma')).toBe(false);
    const before = commands().length; trackAdsPage('/'); expect(commands()).toHaveLength(before);
    expect(writes.length).toBeGreaterThan(0); expect(writes.every(value => value.startsWith('_gcl_aw='))).toBe(true);
    expect(readAdsConsent()?.allowed).toBe(false);
  });
  it('fails closed when browser storage is blocked', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw Error('blocked'); }, setItem: () => { throw Error('blocked'); } });
    expect(() => saveAdsConsent(true)).not.toThrow(); initializeGoogleAds('label');
    expect(adsAllowed()).toBe(false); expect(scripts).toHaveLength(0);
  });
});
