import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import { saveAs } from "file-saver";
import { parseHighlightSegments } from "./highlightText";
import { isReadingAnswerCorrect, readingCorrectAnswerLabel, readingStudentAnswerLabel, type ReadingQuestion } from "./readingGrading";

interface DocSection {
  heading: string;
  body: string; // may contain **highlighted** phrases
}

function highlightedRuns(line: string): TextRun[] {
  const segments = parseHighlightSegments(line);
  if (segments.length === 0) return [new TextRun({ text: "" })];
  return segments.map(
    (seg) =>
      new TextRun({
        text: seg.text,
        highlight: seg.highlight ? "yellow" : undefined,
        bold: seg.highlight
      })
  );
}

async function buildAndDownload(filename: string, title: string, sections: DocSection[]) {
  const children: Paragraph[] = [
    new Paragraph({ text: title, heading: HeadingLevel.TITLE, spacing: { after: 300 } })
  ];

  for (const section of sections) {
    if (!section.body?.trim()) continue;
    children.push(
      new Paragraph({ text: section.heading, heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 } })
    );
    const lines = section.body.split("\n").filter((l) => l.trim() !== "");
    for (const line of lines) {
      children.push(new Paragraph({ children: highlightedRuns(line), spacing: { after: 120 } }));
    }
  }

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, filename);
}

export async function exportWritingToWord(params: {
  promptEn: string;
  promptVi: string;
  submission: string;
  feedback: { overall: string; grammar: string; vocabulary: string; organization: string; suggestions: string[] };
}) {
  const { promptEn, promptVi, submission, feedback } = params;
  await buildAndDownload(`LucyTutor-LuyenViet-${Date.now()}.docx`, "Bài Luyện Viết", [
    { heading: "Đề bài (English)", body: promptEn },
    { heading: "Đề bài (Tiếng Việt)", body: promptVi },
    { heading: "Bài làm của học viên", body: submission },
    { heading: "Nhận xét tổng quan", body: feedback.overall },
    { heading: "Phân tích ngữ pháp", body: feedback.grammar },
    { heading: "Phân tích từ vựng", body: feedback.vocabulary },
    { heading: "Bố cục", body: feedback.organization },
    { heading: "Gợi ý cải thiện", body: feedback.suggestions.map((s, i) => `${i + 1}. ${s}`).join("\n") }
  ]);
}

export async function exportReadingToWord(params: {
  title: string;
  passage: string;
  questions: ReadingQuestion[];
  answers: Record<number, number | string>;
}) {
  const { title, passage, questions, answers } = params;
  const sections: DocSection[] = [{ heading: "Đoạn văn", body: passage }];

  questions.forEach((q, i) => {
    const studentAnswer = readingStudentAnswerLabel(q, answers[i]);
    const correctAnswer = readingCorrectAnswerLabel(q);
    const isCorrect = isReadingAnswerCorrect(q, answers[i]);
    sections.push({
      heading: `Câu ${i + 1}`,
      body: [
        q.question,
        `Bài làm của học viên: ${studentAnswer} — ${isCorrect ? "Đúng" : "Sai"}`,
        `Đáp án đúng: ${correctAnswer}`,
        q.explanation
      ].join("\n")
    });
  });

  await buildAndDownload(`LucyTutor-LuyenDoc-${Date.now()}.docx`, title, sections);
}
