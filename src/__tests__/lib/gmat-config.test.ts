import { describe, it, expect } from "vitest";
import { EXAM_CONFIG } from "@/lib/gmat/config";

describe("GMAT Config", () => {
  it("has correct exam ID", () => {
    expect(EXAM_CONFIG.examId).toBe("EXAM012");
  });

  it("has valid theme colors", () => {
    expect(EXAM_CONFIG.themeColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(EXAM_CONFIG.themeColorDark).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it("has correct URL", () => {
    expect(EXAM_CONFIG.url).toBe("https://gmat.koydo.app");
  });

  it("has sections defined", () => {
    expect(EXAM_CONFIG.sections.length).toBeGreaterThan(0);
  });

  it("has freemium gate configured", () => {
    expect(EXAM_CONFIG.freemiumGate.dailyQuestions).toBe(10);
  });

  it("has IP disclaimer", () => {
    expect(EXAM_CONFIG.ipDisclaimer.length).toBeGreaterThan(0);
  });
});
