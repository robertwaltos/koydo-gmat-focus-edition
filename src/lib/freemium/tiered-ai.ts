/**
 * Tiered AI resolver — maps (tier, feature) -> concrete model + token budget.
 *
 * This is the ONE place where "pay more, get better AI" is encoded for the
 * whole platform. Individual routes import resolveTieredModel() rather than
 * hard-coding "gpt-4o-mini" so a pricing change can be rolled out by
 * editing this file alone.
 */

import type { FreemiumTier } from "./quota";

export type FeatureKey =
  | "ai_tutor"
  | "photo_tutor"
  | "essay_grader"
  | "music_create"
  | "speech_grading"
  | "tutor_explain"
  | "flashcard_gen"
  | "image_generation"
  | "transcription"
  | "lecture_process"
  | "story_generate"
  | "translate_ai";

export type ModelChoice = {
  provider: "openai" | "anthropic" | "gemini" | "fal";
  model: string;
  maxTokens: number;
  temperature: number;
  /** Cost band — 1 = cheapest, 5 = premium. Useful for cost dashboards. */
  costBand: 1 | 2 | 3 | 4 | 5;
};

// Canonical model defaults. Update in ONE place when models rev.
const MODELS = {
  // OpenAI
  gpt_mini:   { provider: "openai",    model: "gpt-4o-mini",            costBand: 1 },
  gpt_std:    { provider: "openai",    model: "gpt-4o",                 costBand: 3 },
  gpt_o1:     { provider: "openai",    model: "o1-mini",                costBand: 4 },
  whisper:    { provider: "openai",    model: "whisper-1",              costBand: 2 },
  // Anthropic
  haiku:      { provider: "anthropic", model: "claude-haiku-4-5-20251001", costBand: 1 },
  sonnet:     { provider: "anthropic", model: "claude-sonnet-4-6",      costBand: 3 },
  opus:       { provider: "anthropic", model: "claude-opus-4-7",        costBand: 5 },
  // Gemini
  gemini_flash: { provider: "gemini",  model: "gemini-2.0-flash",       costBand: 1 },
  // fal.ai
  fal_sdxl:   { provider: "fal",       model: "fal-ai/fast-sdxl",       costBand: 2 },
  fal_flux:   { provider: "fal",       model: "fal-ai/flux/dev",        costBand: 4 },
} as const;

function make(base: (typeof MODELS)[keyof typeof MODELS], maxTokens: number, temperature = 0.4): ModelChoice {
  return {
    provider: base.provider as ModelChoice["provider"],
    model: base.model,
    maxTokens,
    temperature,
    costBand: base.costBand as ModelChoice["costBand"],
  };
}

/**
 * Return the (model, tokens) a request should use given its tier + feature.
 * Free tier always gets the cheapest sensible option — it's the "taste" of
 * the product. Ultra gets the top-shelf model.
 */
export function resolveTieredModel(tier: FreemiumTier, feature: FeatureKey): ModelChoice {
  switch (feature) {
    case "photo_tutor":
      if (tier === "ultra")  return make(MODELS.sonnet, 800, 0.2);
      return make(MODELS.haiku, 400, 0.0);

    case "ai_tutor":
    case "tutor_explain":
      if (tier === "ultra")  return make(MODELS.opus, 2048);
      if (tier === "family") return make(MODELS.sonnet, 1536);
      if (tier === "plus")   return make(MODELS.gpt_std, 1024);
      return make(MODELS.gpt_mini, 512);

    case "essay_grader":
      if (tier === "ultra")  return make(MODELS.opus, 2048, 0.3);
      if (tier === "family" || tier === "plus" || tier === "school")
        return make(MODELS.sonnet, 1536, 0.3);
      return make(MODELS.gpt_mini, 512, 0.3);

    case "speech_grading":
      // Whisper is the only transcription option; the tier affects the
      // downstream evaluator model instead.
      if (tier === "ultra")  return make(MODELS.opus, 512, 0.2);
      if (tier === "plus" || tier === "family" || tier === "school")
        return make(MODELS.gpt_std, 400, 0.2);
      return make(MODELS.gpt_mini, 400, 0.2);

    case "transcription":
      return make(MODELS.whisper, 0, 0);

    case "lecture_process":
      if (tier === "ultra")  return make(MODELS.sonnet, 3000, 0.3);
      return make(MODELS.gemini_flash, 2000, 0.3);

    case "music_create":
    case "flashcard_gen":
    case "story_generate":
      if (tier === "ultra")  return make(MODELS.gpt_std, 1024);
      return make(MODELS.gpt_mini, 512);

    case "image_generation":
      if (tier === "ultra")  return make(MODELS.fal_flux, 0, 0);
      return make(MODELS.fal_sdxl, 0, 0);

    case "translate_ai":
      if (tier === "ultra" || tier === "family") return make(MODELS.gpt_std, 600, 0.2);
      return make(MODELS.gpt_mini, 400, 0.2);
  }
}
