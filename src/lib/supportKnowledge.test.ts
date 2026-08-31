import { describe, expect, it } from "vitest";
import { findSupportTopic, SUPPORT_TOPICS } from "./supportKnowledge";

describe("canonical NITIDO support knowledge", () => {
  it("contains every requested canonical topic with unique ids and complete answers", () => {
    expect(SUPPORT_TOPICS).toHaveLength(60);
    expect(new Set(SUPPORT_TOPICS.map((topic) => topic.id)).size).toBe(60);
    for (const topic of SUPPORT_TOPICS) {
      expect(topic.answer.trim().length, topic.title).toBeGreaterThan(80);
      expect(topic.answer.trim(), topic.title).toMatch(/[.!?]$/);
      expect(findSupportTopic(topic.title)?.id, topic.title).toBe(topic.id);
    }
  });

  it("preserves Romanian diacritics", () => {
    const corpus = SUPPORT_TOPICS.map((topic) => `${topic.title} ${topic.answer}`).join(" ");
    for (const character of ["ă", "â", "î", "ș", "ț"]) expect(corpus).toContain(character);
    expect(corpus).not.toMatch(/Ã|È|Å/);
  });

  it("keeps client, firm and unauthenticated safety facts explicit", () => {
    expect(findSupportTopic("Ce date personale vede firma?")?.answer).toContain("Înainte de alocare");
    expect(findSupportTopic("De ce nu pot accepta o lucrare?")?.audience).toBe("firma");
    expect(findSupportTopic("Cum îmi modific profilul?")?.answer).toContain("Autentifică-te");
    expect(findSupportTopic("Când vede firma adresa exactă?")?.answer).toContain("numai firmei care a câștigat");
  });

  it("never grants AI payment, allocation or admin authority", () => {
    const answer = findSupportTopic("Ce poate și ce nu poate face Asistentul AI?")?.answer ?? "";
    expect(answer).toContain("nu poate accepta sau atribui lucrări");
    expect(answer).toContain("plăți, rambursări sau payout-uri");
    expect(answer).toContain("date administrative");
  });

  it("does not map an unknown feature to invented functionality", () => {
    expect(findSupportTopic("Poți programa roboți autonomi pentru geamuri?")).toBeUndefined();
  });

  it.each([
    ["Când ia firma banii?","payout"],
    ["Pot finaliza fără poza de final?","completion-proof"],
    ["De ce nu văd strada?","exact-address"],
    ["Cum primesc firmele lucrările?","accept-job"],
    ["Ce procent reține NITIDO?","hidden-fees"],
    ["Dacă două firme apasă Accept simultan?","simultaneous-accept"],
    ["Cum funcționează SMS-ul?","sms"],
    ["Cum urmăresc firma?","track-status"],
    ["Cum raportez o recenzie?","report-review"],
    ["Pot folosi NITIDO fără aplicație?","without-mobile-app"],
    ["Cum îmi șterg contul?","delete-account"],
    ["Cine vede pozele?","photo-visibility"],
    ["Ce face AI-ul?","ai-capabilities"],
    ["Cum contactez un om?","contact-support"],
  ])("resolves free-form question %s",(question,id)=>{
    const topic=findSupportTopic(question);
    expect(topic?.id).toBe(id);
    expect(topic?.answer.trim()).toMatch(/[.!?]$/);
    expect(topic?.answer.length).toBeGreaterThan(80);
  });

  it("states the nominal split without calling it net profit",()=>{
    const answer=findSupportTopic("Ce procent oprește NITIDO?")?.answer??"";
    expect(answer).toContain("18%");expect(answer).toContain("82%");expect(answer).toContain("nu profit net");
  });
});
