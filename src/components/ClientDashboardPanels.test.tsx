// @vitest-environment jsdom
import React, {act} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {beforeEach, afterEach, expect, it, vi} from 'vitest';
import type {JobRow} from '@/lib/types';

vi.mock('next-intl', () => ({useMessages: () => ({ui:{}}), useLocale: () => 'ro'}));
import {ClientOverview} from './ClientOverview';
import {ClientReservationList, ClientPaymentHistory} from './ClientDashboardPanels';

let root: Root, host: HTMLDivElement;
const booking = (id: string, changes: Partial<JobRow> = {}): JobRow => ({
  id, client_id:'test-client', city:'Oraș test', street:`Strada ${id}`, postal_code:null, floor:null,
  sqm:70, space_type:'apartament', when_type:'scheduled', scheduled_at:'2026-11-10T10:00:00Z',
  price_gross:100, credit_applied:0, duration_minutes:120, buffer_minutes:30, photos_count:0,
  status:'accepted', accepted_firm_id:'test-firm', accepted_at:null, arrived_confirmed_at:null,
  completed_at:null, created_at:'2026-10-31T10:00:00Z', ...changes,
});

beforeEach(() => {
  Object.assign(globalThis, {IS_REACT_ACT_ENVIRONMENT:true});
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(() => root.unmount()); host.remove(); });
const render = async (node: React.ReactNode) => { await act(() => root.render(node)); };

it('opens the earliest active booking and excludes completed/cancelled history from the next visit', async () => {
  const next = booking('next');
  const onSelect = vi.fn();
  await render(<ClientOverview jobs={[
    booking('completed', {status:'completed', scheduled_at:'2026-11-01T10:00:00Z'}),
    booking('cancelled', {status:'cancelled', scheduled_at:'2026-11-02T10:00:00Z'}),
    booking('later', {scheduled_at:'2026-11-11T10:00:00Z'}), next,
  ]} onSelect={onSelect} onBook={vi.fn()}/>);
  expect(host.textContent).toContain('Strada next');
  expect(host.textContent).not.toContain('Strada completed');
  await act(() => host.querySelector('button')!.click());
  expect(onSelect).toHaveBeenCalledWith(next);
  expect(host.querySelector('a')?.getAttribute('href')).toBe('/client/rezervari');
});

it('never presents a failed or loading booking request as an empty account', async () => {
  const onRetry = vi.fn();
  await render(<ClientOverview jobs={[]} loading onSelect={vi.fn()} onBook={vi.fn()}/>);
  expect(host.querySelector('[role=status]')?.textContent).toContain('Se încarcă');
  expect(host.textContent).not.toContain('Prima ta rezervare');
  await render(<ClientOverview jobs={[]} error="Conexiune indisponibilă" onRetry={onRetry} onSelect={vi.fn()} onBook={vi.fn()}/>);
  expect(host.querySelector('[role=alert]')?.textContent).toContain('Conexiune indisponibilă');
  expect(host.textContent).not.toContain('Prima ta rezervare');
  await act(() => host.querySelector('button')!.click());
  expect(onRetry).toHaveBeenCalledOnce();
});

it('keeps the home history compact and sends the exact selected record to its detail', async () => {
  const jobs = [1,2,3,4].map(n=>booking(String(n),{created_at:`2026-10-${20+n}T10:00:00Z`}));
  const onSelect = vi.fn();
  await render(<ClientReservationList jobs={jobs} compact onSelect={onSelect} onBook={vi.fn()}/>);
  expect(host.querySelectorAll('.client-reservation-row')).toHaveLength(3);
  expect(host.textContent).not.toContain('Strada 1');
  await act(() => host.querySelector('button')!.click());
  expect(onSelect).toHaveBeenCalledWith(jobs[3]);
  expect(host.querySelector('a')?.getAttribute('href')).toBe('/client/rezervari');
});

it('preserves the repeat-booking entry for completed work with its original reference', async () => {
  await render(<ClientReservationList jobs={[booking('completed', {status:'completed'})]} onSelect={vi.fn()} onBook={vi.fn()}/>);
  expect(host.querySelector('a')?.getAttribute('href')).toBe('/client?repeatJobId=completed#sec-form');
});

it('shows only explicit financial confirmation, independently of completed execution', async () => {
  await render(<ClientPaymentHistory jobs={[booking('unknown', {status:'completed'})]} onSelect={vi.fn()}/>);
  expect(host.textContent).toContain('Starea plății nu este confirmată');
  expect(host.textContent).not.toContain('Plată încasată');
  expect(host.textContent).toContain('100 lei');
  await render(<ClientPaymentHistory jobs={[booking('paid', {financial:{paymentStatus:'captured',transferStatus:'none',payoutStatus:'none',refundStatus:'none',disputeStatus:'none'}})]} onSelect={vi.fn()}/>);
  expect(host.textContent).toContain('Plată încasată');
});
