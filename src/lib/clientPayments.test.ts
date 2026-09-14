import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Sqlite from "better-sqlite3";
const mocks = vi.hoisted(() => ({ customer: vi.fn(), createCustomer: vi.fn(), createSession: vi.fn(), session: vi.fn(), setup: vi.fn(), method: vi.fn() }));
vi.mock("@/lib/payments", () => ({ getStripeClient: () => ({ customers: { retrieve: mocks.customer, create: mocks.createCustomer }, checkout: { sessions: { create: mocks.createSession, retrieve: mocks.session } }, setupIntents: { retrieve: mocks.setup }, paymentMethods: { retrieve: mocks.method } }) }));
import {initializeSavedCards} from "./savedCards";
import { createCardSetupSession, syncClientDefaultCard } from "./clientPayments";
let db: Sqlite.Database;
const session = (extra = {}) => ({ id: "cs_test_current", mode: "setup", status: "complete", customer: "cus_owner", client_reference_id: "owner", setup_intent: "seti_new", metadata: { previousPaymentMethodId: "pm_old" }, ...extra });
const setup = (extra = {}) => ({ id: "seti_new", status: "succeeded", customer: "cus_owner", payment_method: "pm_new", ...extra });
const method = (extra = {}) => ({ id: "pm_new", type: "card", customer: "cus_owner", card: { brand:"visa", last4: "3155", exp_month:12, exp_year:2034 }, ...extra });
const saved = () => db.prepare("SELECT stripe_customer_id, stripe_payment_method_id FROM users WHERE id='owner'").get();
const confirm = () => syncClientDefaultCard(db, "owner", "cs_test_current");
beforeEach(() => {
  vi.resetAllMocks();
  db = new Sqlite(":memory:");
  db.exec(`CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT,name TEXT,stripe_customer_id TEXT,stripe_payment_method_id TEXT);
    INSERT INTO users VALUES('owner','owner@example.test','Owner','cus_owner','pm_old');
    CREATE TABLE payments(id TEXT PRIMARY KEY,status TEXT,payment_method TEXT,amount INTEGER);
    INSERT INTO payments VALUES('authorized','authorized','pm_old',55000),('captured','captured','pm_old',62900);
    CREATE TRIGGER preserve_payments BEFORE UPDATE ON payments BEGIN SELECT RAISE(ABORT,'Existing payment changed'); END;`);
  db.exec("CREATE TABLE jobs(id TEXT PRIMARY KEY,client_id TEXT,status TEXT); CREATE TABLE payment_authorization_attempts(job_id TEXT,request_json TEXT)");
  initializeSavedCards(db);
  mocks.customer.mockResolvedValue({ id: "cus_owner" });
  mocks.createSession.mockResolvedValue({ url: "https://checkout.stripe.com/c/pay/cs_test_current" });
  mocks.session.mockResolvedValue(session()); mocks.setup.mockResolvedValue(setup()); mocks.method.mockResolvedValue(method());
});
afterEach(() => db.close());
describe("multiple saved card setup", () => {
  it("opens setup for the existing customer, preserving the old card until completion", async () => {
    await createCardSetupSession(db, "owner", "https://sandbox.nitido.ro");
    expect(mocks.createSession).toHaveBeenCalledWith(expect.objectContaining({ mode: "setup", customer: "cus_owner", client_reference_id: "owner", metadata: { flow: "saved_cards_v1" }, success_url: "https://sandbox.nitido.ro/client?card=added&session_id={CHECKOUT_SESSION_ID}" }));
    expect(saved()).toEqual({ stripe_customer_id: "cus_owner", stripe_payment_method_id: "pm_old" });
    expect(mocks.createCustomer).not.toHaveBeenCalled();
  });
  it("does not reset a customer's card after a transient Stripe failure", async () => {
    mocks.customer.mockRejectedValue(new Error("provider unavailable"));
    await expect(createCardSetupSession(db, "owner", "https://sandbox.nitido.ro")).rejects.toThrow();
    expect(saved()).toHaveProperty("stripe_payment_method_id", "pm_old");
    expect(mocks.createCustomer).not.toHaveBeenCalled();
    expect(mocks.createSession).not.toHaveBeenCalled();
  });
  it("uses the exact completed session's card and preserves authorized/captured payments", async () => {
    const payments = db.prepare("SELECT * FROM payments").all();
    expect(await confirm()).toBe(true);
    expect(mocks.method).toHaveBeenCalledWith("pm_new");
    expect(saved()).toHaveProperty("stripe_payment_method_id", "pm_old");
    expect(db.prepare("SELECT * FROM payments").all()).toEqual(payments);
    expect(await confirm()).toBe(true);
  });
  it("supports the first card without a previous default", async () => {
    db.exec("UPDATE users SET stripe_payment_method_id=NULL; DELETE FROM client_saved_cards");
    mocks.session.mockResolvedValue(session({ metadata: { previousPaymentMethodId: "" } }));
    expect(await confirm()).toBe(true);
    expect(saved()).toHaveProperty("stripe_payment_method_id", "pm_new");
  });
  it.each([{ status: "open" }, { status: "expired" }, { mode: "payment" }, { customer: "cus_other" }, { client_reference_id: "other" }, { setup_intent: null }, { metadata: {} }, { id: "cs_test_other" }])("rejects incomplete or foreign sessions %j without changing the card", async invalid => {
    mocks.session.mockResolvedValue(session(invalid));
    await expect(confirm()).rejects.toThrow();
    expect(saved()).toHaveProperty("stripe_payment_method_id", "pm_old");
    expect(mocks.setup).not.toHaveBeenCalled();
  });
  it.each([{ status: "requires_action" }, { status: "canceled" }, { status: "requires_payment_method" }, { customer: "cus_other" }, { payment_method: null }, { id: "seti_other" }])("preserves the old card for an unconfirmed setup %j", async invalid => {
    mocks.setup.mockResolvedValue(setup(invalid));
    await expect(confirm()).rejects.toThrow();
    expect(saved()).toHaveProperty("stripe_payment_method_id", "pm_old");
  });
  it.each([{ customer: "cus_other" }, { type: "sepa_debit" }, { card: null }, { id: "pm_other" }])("rejects an incompatible payment method %j", async invalid => {
    mocks.method.mockResolvedValue(method(invalid));
    await expect(confirm()).rejects.toThrow();
    expect(saved()).toHaveProperty("stripe_payment_method_id", "pm_old");
  });
  it("does not overwrite a newer selection when an older tab returns", async () => {
    db.exec("UPDATE users SET stripe_payment_method_id='pm_newer'");
    expect(await confirm()).toBe(true);
    expect(saved()).toHaveProperty("stripe_payment_method_id", "pm_newer");
  });
  it("rechecks changes made during the Stripe call", async () => {
    mocks.method.mockImplementation(async () => { db.exec("UPDATE users SET stripe_payment_method_id='pm_concurrent'"); return method(); });
    expect(await confirm()).toBe(true);
    expect(saved()).toHaveProperty("stripe_payment_method_id", "pm_concurrent");
  });
  it("rejects a changed customer during confirmation", async () => {
    mocks.method.mockImplementation(async () => { db.exec("UPDATE users SET stripe_customer_id='cus_new'"); return method(); });
    await expect(confirm()).rejects.toThrow("Contul de plată");
    expect(saved()).toHaveProperty("stripe_payment_method_id", "pm_old");
  });
  it.each(["", "not_a_session", "cs_" + "a".repeat(241)])("rejects invalid session ID %s before Stripe", async id => {
    await expect(syncClientDefaultCard(db, "owner", id)).rejects.toThrow();
    expect(mocks.session).not.toHaveBeenCalled();
  });
  it("keeps the old card if confirmation temporarily fails, then permits retry", async () => {
    mocks.setup.mockRejectedValueOnce(Error("timeout"));
    await expect(confirm()).rejects.toThrow();
    expect(saved()).toHaveProperty("stripe_payment_method_id", "pm_old");
    expect(await confirm()).toBe(true);
  });
});
