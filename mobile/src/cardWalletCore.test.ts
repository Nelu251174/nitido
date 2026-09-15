import {describe,expect,it} from "vitest";
import {checkoutTarget,selectAvailableCard,type WalletCard} from "./cardWalletCore";
const cards:WalletCard[]=[{id:"card_a",brand:"visa",last4:"4242",expMonth:12,expYear:2034,isDefault:true},{id:"card_b",brand:"mastercard",last4:"4444",expMonth:1,expYear:2035,isDefault:false}];
describe("mobile saved cards",()=>{
 it("preserves a deliberate selection across refreshes",()=>expect(selectAvailableCard(cards,"card_b")).toBe("card_b"));
 it("selects the default when a previous card is gone",()=>expect(selectAvailableCard(cards,"removed")).toBe("card_a"));
 it("returns no selection when no card is available",()=>expect(selectAvailableCard([],"card_a")).toBeNull());
 it("accepts only the trusted Stripe Checkout target",()=>expect(checkoutTarget({url:"https://checkout.stripe.com/c/pay/test",sessionId:"cs_test_1"}).sessionId).toBe("cs_test_1"));
 it.each(["https://checkout.stripe.com.attacker.test/path","http://checkout.stripe.com/path","https://user@checkout.stripe.com/path","javascript:alert(1)"])("rejects unsafe checkout targets %s",url=>expect(()=>checkoutTarget({url,sessionId:"cs_test_1"})).toThrow());
 it("rejects missing session identity",()=>expect(()=>checkoutTarget({url:"https://checkout.stripe.com/test"})).toThrow());
});
