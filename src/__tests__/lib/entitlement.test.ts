import { describe, it, expect } from "vitest";
import {
  canAccessQuestion,
  getRemainingFreeQuestions,
  isTrialActive,
} from "@/lib/gmat/entitlement";

describe("Entitlement", () => {
  it("allows premium users unlimited access", () => {
    expect(
      canAccessQuestion({
        premiumActive: true,
        dailyQuestionsUsed: 999,
        dailyQuestionsLimit: 10,
      })
    ).toBe(true);
  });

  it("allows free users within daily limit", () => {
    expect(
      canAccessQuestion({
        premiumActive: false,
        dailyQuestionsUsed: 5,
        dailyQuestionsLimit: 10,
      })
    ).toBe(true);
  });

  it("blocks free users past daily limit", () => {
    expect(
      canAccessQuestion({
        premiumActive: false,
        dailyQuestionsUsed: 10,
        dailyQuestionsLimit: 10,
      })
    ).toBe(false);
  });

  it("returns remaining free questions", () => {
    expect(
      getRemainingFreeQuestions({
        premiumActive: false,
        dailyQuestionsUsed: 7,
        dailyQuestionsLimit: 10,
      })
    ).toBe(3);
  });

  it("returns Infinity for premium", () => {
    expect(
      getRemainingFreeQuestions({
        premiumActive: true,
        dailyQuestionsUsed: 0,
        dailyQuestionsLimit: 10,
      })
    ).toBe(Infinity);
  });

  it("detects active trial", () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    expect(
      isTrialActive({
        premiumActive: false,
        dailyQuestionsUsed: 0,
        dailyQuestionsLimit: 10,
        trialEndsAt: future,
      })
    ).toBe(true);
  });

  it("detects expired trial", () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    expect(
      isTrialActive({
        premiumActive: false,
        dailyQuestionsUsed: 0,
        dailyQuestionsLimit: 10,
        trialEndsAt: past,
      })
    ).toBe(false);
  });
});
