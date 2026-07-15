import { cleanString, levenshteinDistance } from "./textGrading";

export type QuestionType =
  | "MULTIPLE_CHOICE"
  | "TRUE_FALSE"
  | "FILL_BLANK"
  | "YES_NO_NOTGIVEN"
  | "MATCHING_HEADING"
  | "MATCHING_INFORMATION"
  | "MATCHING_FEATURES"
  | "SUMMARY_COMPLETION"
  | "SENTENCE_COMPLETION"
  | "SHORT_ANSWER";

// Types graded as free-text (Levenshtein-tolerant); everything else is graded by option index.
export const FILL_TYPES: QuestionType[] = ["FILL_BLANK", "SENTENCE_COMPLETION", "SHORT_ANSWER"];

export const QUESTION_TYPE_META: Record<QuestionType, { label: string; instruction: string }> = {
  MULTIPLE_CHOICE: { label: "Trắc nghiệm", instruction: "Chọn đáp án đúng nhất." },
  TRUE_FALSE: { label: "Đúng / Sai", instruction: "Xác định câu sau đúng hay sai so với bài đọc." },
  FILL_BLANK: { label: "Điền từ", instruction: "Điền từ còn thiếu vào chỗ trống." },
  YES_NO_NOTGIVEN: { label: "Yes / No / Not Given", instruction: "Xác định thông tin có đúng, sai, hay không được đề cập trong bài." },
  MATCHING_HEADING: { label: "Nối tiêu đề đoạn văn", instruction: "Chọn tiêu đề phù hợp nhất cho đoạn văn." },
  MATCHING_INFORMATION: { label: "Nối thông tin với đoạn văn", instruction: "Xác định thông tin nằm ở đoạn văn nào." },
  MATCHING_FEATURES: { label: "Nối đặc điểm", instruction: "Nối nhận định với đối tượng/nhân vật phù hợp." },
  SUMMARY_COMPLETION: { label: "Hoàn thành tóm tắt", instruction: "Chọn từ phù hợp trong ngân hàng từ để hoàn thành đoạn tóm tắt." },
  SENTENCE_COMPLETION: { label: "Hoàn thành câu", instruction: "Điền từ/cụm từ lấy từ bài đọc để hoàn thành câu." },
  SHORT_ANSWER: { label: "Trả lời ngắn", instruction: "Trả lời ngắn gọn bằng từ/cụm từ lấy từ bài đọc." },
};

export interface ReadingQuestion {
  type: QuestionType;
  question: string;
  options?: string[];
  correctIndex?: number;
  correctAnswer?: string;
  wordLimit?: string; // e.g. "KHÔNG QUÁ 2 TỪ" — hint shown for completion-style questions
  explanation: string;
}

export function isReadingAnswerCorrect(q: ReadingQuestion, answer: number | string | undefined): boolean {
  if (answer === undefined) return false;
  if (FILL_TYPES.includes(q.type)) {
    const cleanUser = cleanString(String(answer));
    const cleanCorrect = cleanString(q.correctAnswer || "");
    if (!cleanUser) return false;
    const maxTypoDistance = cleanCorrect.length <= 4 ? 1 : 2;
    return cleanUser === cleanCorrect || levenshteinDistance(cleanUser, cleanCorrect) <= maxTypoDistance;
  }
  return answer === q.correctIndex;
}

export function readingCorrectAnswerLabel(q: ReadingQuestion): string {
  if (FILL_TYPES.includes(q.type)) return q.correctAnswer || "";
  return q.options?.[q.correctIndex ?? -1] || "";
}

export function readingStudentAnswerLabel(q: ReadingQuestion, answer: number | string | undefined): string {
  if (answer === undefined) return "(chưa trả lời)";
  if (FILL_TYPES.includes(q.type)) return String(answer);
  return q.options?.[answer as number] || "(chưa trả lời)";
}
