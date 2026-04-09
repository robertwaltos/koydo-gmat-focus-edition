export const TRANSLATIONS = {
  en: {
    appName: "Koydo GMAT",
    tagline: "GMAT Focus Edition prep — free practice questions and AI analytics",
    startStudying: "Start Studying Free",
    viewPlans: "View Plans",
    learnHub: "GMAT Study Hub",
    pricing: "Pricing",
    free: "Free",
    premium: "Premium",
    questionsPerDay: "10 questions / day",
    unlimited: "Unlimited",
    privacy: "Privacy Policy",
    terms: "Terms of Service",
  },
} as const;

export type Locale = keyof typeof TRANSLATIONS;
export type TranslationKey = keyof (typeof TRANSLATIONS)["en"];
