import type { UserEntitlement } from "./types";

export function canAccessQuestion(entitlement: UserEntitlement): boolean {
  if (entitlement.premiumActive) return true;
  return entitlement.dailyQuestionsUsed < entitlement.dailyQuestionsLimit;
}

export function getRemainingFreeQuestions(entitlement: UserEntitlement): number {
  if (entitlement.premiumActive) return Infinity;
  return Math.max(
    0,
    entitlement.dailyQuestionsLimit - entitlement.dailyQuestionsUsed
  );
}

export function isTrialActive(entitlement: UserEntitlement): boolean {
  if (!entitlement.trialEndsAt) return false;
  return new Date(entitlement.trialEndsAt) > new Date();
}
