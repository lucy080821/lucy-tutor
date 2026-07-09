import { cleanString, levenshteinDistance } from "./textGrading";

export type QuestionType = "MULTIPLE_CHOICE" | "TRUE_FALSE" | "FILL_BLANK";

export interface ReadingQuestion {
  type: QuestionType;
  question: string;
  options?: string[];
  correctIndex?: number;
  correctAnswer?: string;
  explanation: string;
}

export function isReadingAnswerCorrect(q: ReadingQuestion, answer: number | string | undefined): boolean {
  if (answer === undefined) return false;
  if (q.type === "FILL_BLANK") {
    const cleanUser = cleanString(String(answer));
    const cleanCorrect = cleanString(q.correctAnswer || "");
    if (!cleanUser) return false;
    const maxTypoDistance = cleanCorrect.length <= 4 ? 1 : 2;
    return cleanUser === cleanCorrect || levenshteinDistance(cleanUser, cleanCorrect) <= maxTypoDistance;
  }
  return answer === q.correctIndex;
}

export function readingCorrectAnswerLabel(q: ReadingQuestion): string {
  if (q.type === "FILL_BLANK") return q.correctAnswer || "";
  return q.options?.[q.correctIndex ?? -1] || "";
}

export function readingStudentAnswerLabel(q: ReadingQuestion, answer: number | string | undefined): string {
  if (answer === undefined) return "(chưa trả lời)";
  if (q.type === "FILL_BLANK") return String(answer);
  return q.options?.[answer as number] || "(chưa trả lời)";
}
