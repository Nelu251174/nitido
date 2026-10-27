// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AdminMarketingCampaignSend } from './AdminMarketingCampaignSend';
import type { MarketingCampaign } from '@/lib/adminMarketingWorkspaceShared';
let campaign: MarketingCampaign, root: Root, host: HTMLDivElement, fetcher: ReturnType<typeof vi.fn>;
let blockers: string[], eligible: number, delivery: boolean;
const onSettings = vi.fn(), onContacts = vi.fn(), onCreated = vi.fn(async () => {});
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value: function(this: HTMLDialogElement) { this.setAttribute('open', ''); } },
    close: { configurable: true, value: function(this: HTMLDialogElement) { this.removeAttribute('open'); this.dispatchEvent(new Event('close')); } },
  });
  campaign = { id: 'campaign-fixture', version: 1, name: 'București · Clienți business · B', subject: 'Subiect', body: 'Mesaj', category: 'business', county: 'B', city: '', variant: 'B', recipientLimit: 50, ctaLabel: '', ctaUrl: '', budgetRon: null, state: 'draft', updatedAt: '' };
  blockers = ['Completează expeditorul în Setări.', 'Nu există contacte eligibile.']; eligible = 0; delivery = false;
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    if (!init?.body) return Response.json({ readiness: { enabled: delivery, providerConfigured: true, webhookConfigured: delivery } });
    const body = JSON.parse(String(init.body));
    if (body.action === 'preview') return Response.json({ result: { selected: 6003, eligible, excluded: 6003 - eligible, deferred: 0, reasons: { noConsent: 6003 - eligible, noEmail: 0, notReviewed: 0, unverifiedEmail: 0, duplicate: 0, suppressed: 0 }, blockers, html: '<p>fixture</p>' } });
    if (body.action === 'save' && !body.data.id) return Response.json({result:{...body.data,id:'copy-fixture',version:1,state:'draft'}});
    if (body.action === 'save') { campaign = { ...body.data, version: campaign.version + 1, state: 'draft' }; return Response.json({ result: campaign }); }
    if (body.action === 'state') { campaign = { ...campaign, version: campaign.version + 1, state: 'ready' }; return Response.json({ result: campaign }); }
    if (body.action === 'queue') return Response.json({ result: { id: 'synthetic-run' } });
    throw Error('Unexpected operation: ' + url);
  }); vi.stubGlobal('fetch', fetcher);
});
afterEach(async () => { await act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
function view(): React.ReactNode { return <AdminMarketingCampaignSend campaign={campaign} onChanged={async () => { root.render(view()); }} onSettings={onSettings} onContacts={onContacts} onCreated={onCreated}/>; }
async function render() { await act(() => root.render(view())); }
async function click(label: string) { const button = [...host.querySelectorAll('button')].find(b => b.textContent === label)!; expect(button).toBeDefined(); await act(() => button.click()); }
const writes = () => fetcher.mock.calls.filter(([, init]) => init?.body).map(([, init]) => JSON.parse(String(init!.body)));
it('keeps bulk sending discoverable for a blocked draft and shows actionable reasons without preparing or sending', async () => {
  await render(); expect(fetcher).not.toHaveBeenCalled(); await click('Pregătește campania');
  expect(host.textContent).toContain('6003'); expect(host.textContent).toContain('0 emailuri eligibile'); expect(host.textContent).toContain('Pregătire blocată'); expect(host.textContent).toContain('Trimitere reală: oprită');
  expect(writes().map(x => x.action)).toEqual(['preview']);
  expect([...host.querySelectorAll('button')].find(b => b.textContent === 'Confirmă și trimite emailurile')!.disabled).toBe(true);
  await click('Completează datele în Setări'); expect(onSettings).toHaveBeenCalledOnce(); await click('Verifică acordurile și contactele'); expect(onContacts).toHaveBeenCalledOnce();
});
it('uses the bulk button to check a draft without implicitly saving, preparing, queueing or enabling delivery', async () => {
  await render(); await click('Trimite emailuri în masă'); expect(writes().map(x => x.action)).toEqual(['preview']); expect(host.textContent).toContain('Confirmări livrare: neconfigurate');
});
it('identifies the explicit public business scope without claiming recorded consent or queuing on inspection',async()=>{
 campaign.audienceMode='public_business';blockers=[];eligible=500;delivery=true;campaign.state='ready';
 await render();expect(host.textContent).toContain('Campanie B2B către adrese publice de firme');
 await click('Trimite emailuri în masă');expect(host.textContent).toContain('500 emailuri eligibile');
 expect(writes().some(x=>x.action==='queue')).toBe(false);
 expect([...host.querySelectorAll('button')].find(b=>b.textContent==='Confirmă și trimite emailurile')!.disabled).toBe(true);
});
it('explicitly removes A/B and the 50-recipient cap while retaining București and category, then queues only a manual test', async () => {
  blockers = []; eligible = 6003; await render();
  await act(() => (host.querySelector('input[type="checkbox"]') as HTMLInputElement).click());
  await click('Pregătește campania');
  expect(writes()[0]).toMatchObject({ action: 'save', data: { county: 'B', city: '', category: 'business', variant: '', recipientLimit: null } });
  expect(host.textContent).toContain('6003 emailuri eligibile'); expect(writes().some(x => x.action === 'queue')).toBe(false);
  await click('Testează fără expediere');
  expect(writes().at(-1)).toMatchObject({ action: 'queue', data: { id: campaign.id, version: campaign.version, mode: 'test' } }); expect(writes().at(-1).data).not.toHaveProperty('scheduledAt');
});
it('requires a separate manual confirmation even when live configuration and the audience are ready', async () => {
  blockers = []; eligible = 42; delivery = true; campaign.state = 'ready'; await render(); await click('Trimite emailuri în masă');
  const send = [...host.querySelectorAll('button')].find(b => b.textContent === 'Confirmă și trimite emailurile')!;
  expect(send.disabled).toBe(true); expect(writes().some(x => x.action === 'queue')).toBe(false);
  await act(() => (host.querySelectorAll('input[type="checkbox"]')[1] as HTMLInputElement).click()); await click('Confirmă și trimite emailurile');
  expect(writes().at(-1)).toMatchObject({ action: 'queue', data: { id: campaign.id, mode: 'live' } });
});
it('offers an explicit draft copy for an archived campaign instead of an inert send button', async () => {
  campaign.state = 'archived'; await render(); expect(host.textContent).toContain('Campanie arhivată'); expect(fetcher).not.toHaveBeenCalled();
  expect([...host.querySelectorAll('button')].some(b => b.textContent === 'Trimite emailuri în masă')).toBe(false);
  await click('Creează ciornă din această campanie');
  expect(writes()).toHaveLength(1); expect(writes()[0]).toMatchObject({action:'save',data:{subject:campaign.subject,body:campaign.body,category:'business',county:'B'}}); expect(writes()[0].data).not.toHaveProperty('id');
  expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({id:'copy-fixture',state:'draft'})); expect(campaign.state).toBe('archived');
});
it('invalidates inspection and confirmation after a concurrent campaign edit', async () => {
  blockers = []; eligible = 42; delivery = true; campaign.state = 'ready'; await render(); await click('Trimite emailuri în masă');
  campaign = { ...campaign, version: 2, body: 'Alt text' }; await render(); expect(host.textContent).not.toContain('Confirmă și trimite emailurile'); expect(writes().some(x => x.action === 'queue')).toBe(false);
});

it('opens its modal immediately while the server is responding and can be closed', async () => {
  let finish!: (value:Response) => void; fetcher.mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve; }));
  await render(); await click('Trimite emailuri în masă');
  expect(host.querySelector('dialog')!.open).toBe(true); expect(host.textContent).toContain('Se verifică destinatarii');
  await click('Închide'); expect(host.querySelector('dialog')!.open).toBe(false);
  await act(async () => { finish(Response.json({error:'Eroare de verificare'},{status:503})); });
  expect(host.querySelector('dialog')!.open).toBe(false); expect(writes().some(x => x.action === 'queue')).toBe(false);
});
it('shows network failures in the open modal instead of appearing to do nothing', async () => {
  fetcher.mockRejectedValueOnce(Error('Conexiune indisponibilă')); await render(); await click('Trimite emailuri în masă');
  expect(host.querySelector('dialog')!.open).toBe(true); expect(host.querySelector('dialog [role=alert]')!.textContent).toContain('Conexiune indisponibilă');
});
