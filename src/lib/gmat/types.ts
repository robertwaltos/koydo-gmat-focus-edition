export interface Question {
  id: string;
  examId: string;
  level: string;
  section: string;
  prompt: string;
  options: Option[];
  correctOptionId: string;
  explanation?: string;
  difficulty: "easy" | "medium" | "hard";
  tags: string[];
}

export interface Option {
  id: string;
  label: string;
  text: string;
}

export interface Attempt {
  questionId: string;
  selectedOptionId: string;
  isCorrect: boolean;
  timeSpentMs: number;
  timestamp: string;
}

export interface QuestionResponse {
  questions: Question[];
  total: number;
  page: number;
  perPage: number;
}

export interface UserEntitlement {
  premiumActive: boolean;
  dailyQuestionsUsed: number;
  dailyQuestionsLimit: number;
  trialEndsAt?: string;
}
