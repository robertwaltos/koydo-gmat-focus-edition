export interface PrismSignal {
  event: string;
  examId: string;
  payload?: Record<string, unknown>;
  timestamp?: string;
}

export function emitPrismSignal(signal: PrismSignal): void {
  if (typeof window === "undefined") return;

  const enriched: PrismSignal = {
    ...signal,
    timestamp: signal.timestamp ?? new Date().toISOString(),
  };

  window.dispatchEvent(
    new CustomEvent("koydo:prism-signal", { detail: enriched })
  );
}

export function trackQuestionAttempt(
  examId: string,
  questionId: string,
  correct: boolean,
  timeMs: number
): void {
  emitPrismSignal({
    event: "question_attempt",
    examId,
    payload: { questionId, correct, timeMs },
  });
}
