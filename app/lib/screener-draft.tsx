import { createContext, useContext } from "react";

import type { ScreenerAnswers } from "../../shared/screener";
interface Draft {
  answers: ScreenerAnswers;
  setAnswers: (answers: ScreenerAnswers) => void;
  questionIndex: number;
  setQuestionIndex: (questionIndex: number) => void;
}
export const ScreenerDraftContext = createContext<Draft | null>(null);
export function useScreenerDraft() {
  const draft = useContext(ScreenerDraftContext);
  if (!draft)
    throw new Error("The screener must be inside its draft provider.");
  return draft;
}
