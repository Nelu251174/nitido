import { it, expect } from 'vitest';
import { internalProAllowed, internalProView } from './internalAccess';
it('rejects role escalation, financial writes, owner approvals and unknown adapters by default', () => {
  for (const role of ['operator', 'manager', 'finance'] as const) {
    for (const path of [['activate', 'org'], ['staff', 'org'], ['organizations'], ['invites'], ['members', 'member'], ['settings', 'org'], ['approvals', 'approval'], ['unknown'], ['work-orders', 'work', 'accept']]) expect(internalProAllowed(role, 'POST', path)).toBe(false);
  }
  expect(internalProAllowed('operator', 'POST', ['work-orders', 'work', 'offer'])).toBe(true);
  expect(internalProAllowed('operator', 'POST', ['work-orders', 'work', 'quote'])).toBe(false);
  expect(internalProAllowed('manager', 'POST', ['work-orders', 'work', 'quote'])).toBe(true);
  expect(internalProAllowed('finance', 'POST', ['costs', 'cost'])).toBe(true);
  expect(internalProAllowed('manager', 'POST', ['costs', 'cost'])).toBe(false);
  expect(internalProAllowed('finance', 'GET', ['media', 'photo'])).toBe(false);
  expect(internalProAllowed('finance', 'GET', ['work-orders', 'work', 'credential'])).toBe(false);
  expect(internalProAllowed('operator', 'GET', ['work-orders', 'work', 'credential', 'unknown'])).toBe(false);
});
it('redacts nested financial data for Operator and sensitive access details for Finance', () => {
  const raw = { estimate: 500, final_cost: 400, threshold_snapshot: 200, property: { name: 'A', address: 'Private', instructions: 'Secret' }, approvals: [{ amount: 500 }], permissions: { manage: true, operator: true, approve: true } };
  const operator = internalProView(raw, 'operator'); expect(operator).not.toHaveProperty('estimate'); expect(operator.approvals).toEqual([{}]); expect(operator.property.address).toBe('Private'); expect(operator.permissions).toMatchObject({ manage: false, operator: true, approve: false });
  const finance = internalProView(raw, 'finance'); expect(finance.estimate).toBe(500); expect(finance.property).toEqual({ name: 'A' }); expect(finance.permissions).toMatchObject({ manage: false, operator: false, approve: false });
  expect(internalProView(raw)).toBe(raw); expect(internalProView(raw, 'super_admin')).toBe(raw);
});
