import { describe, it, expect } from "vitest";
import { toE164Romania, sendArrivalSms, sendJobAcceptedSms, sendNewJobAlertSms } from "./sms";

describe("toE164Romania — normalizare telefon RO la E.164", () => {
  it("convertește formatul local 07xxxxxxxx", () => {
    expect(toE164Romania("0721234567")).toBe("+40721234567");
  });
  it("convertește formatul local cu spații/paranteze", () => {
    expect(toE164Romania("0721 234 567")).toBe("+40721234567");
  });
  it("convertește formatul fără 0 (721234567)", () => {
    expect(toE164Romania("721234567")).toBe("+40721234567");
  });
  it("convertește formatul 40721234567 (fără +)", () => {
    expect(toE164Romania("40721234567")).toBe("+40721234567");
  });
  it("lasă neschimbat un E.164 deja corect", () => {
    expect(toE164Romania("+40721234567")).toBe("+40721234567");
  });
  it("returnează null pentru un format neinterpretabil", () => {
    expect(toE164Romania("abc")).toBe(null);
  });
});

describe("sendArrivalSms / sendNewJobAlertSms — no-op fără Twilio configurat", () => {
  it("sendArrivalSms nu aruncă și nu blochează dacă Twilio nu e configurat", async () => {
    await expect(
      sendArrivalSms({ clientPhone: "0721234567", firmName: "Test SRL", street: "Str. X", city: "Constanța" })
    ).resolves.toBeUndefined();
  });

  it("sendNewJobAlertSms trimite în paralel către o listă de telefoane fără să arunce", async () => {
    await expect(
      sendNewJobAlertSms([null, "0721234567", "invalid"], {
        city: "Constanța",
        spaceType: "apartament",
        sqm: 55,
      })
    ).resolves.toBeUndefined();
  });

  it("sendNewJobAlertSms cu listă goală de firme nu aruncă", async () => {
    await expect(
      sendNewJobAlertSms([], { city: "Constanța", spaceType: "casa", sqm: 100 })
    ).resolves.toBeUndefined();
  });

  it("sendJobAcceptedSms nu aruncă și nu blochează dacă Twilio nu e configurat", async () => {
    await expect(
      sendJobAcceptedSms({
        clientPhone: "0721234567",
        firmName: "CleanPro SRL",
        street: "Str. X",
        city: "Constanța",
      })
    ).resolves.toBeUndefined();
  });
});
