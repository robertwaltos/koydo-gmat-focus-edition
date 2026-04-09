export const EXAM_CONFIG = {
  examId: "EXAM012",
  slug: "gmat",
  name: "GMAT",
  fullName: "GMAT Focus Edition",
  description:
    "Free GMAT Focus Edition practice questions for Quantitative, Verbal, and Data Insights with AI analytics.",
  url: "https://gmat.koydo.app",
  category: "Admissions",
  subcategory: "Business school admissions",
  country: "Global",
  region: "Global",
  languages: ["English"] as const,
  primaryLanguage: "en",
  sections: [
    "Quantitative Reasoning",
    "Verbal Reasoning",
    "Data Insights",
  ] as const,
  testFormat: "Computer-adaptive" as const,
  questionFormat: "MCQ, Data Sufficiency, Multi-Source Reasoning" as const,
  scoring: "205–805 total" as const,
  themeColor: "#0D9488",
  themeColorDark: "#0F766E",
  ipRisk: "High" as const,
  ipDisclaimer:
    "GMAT™ is a trademark of the Graduate Management Admission Council (GMAC), which was not involved in the production of, and does not endorse, this product.",
  freemiumGate: {
    dailyQuestions: 10,
  },
  contentReuseCluster: "business_reasoning",
  uiEngineProfile: "objective_adaptive",
} as const;

export type ExamConfig = typeof EXAM_CONFIG;
