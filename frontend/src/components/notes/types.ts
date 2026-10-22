import type { JSONContent } from "@tiptap/react";
import type { PageStyle } from "./pageStyle";

export type Section = { id: string; name: string; color: string; order: number; count: number; notebookId?: string };
export type Notebook = { id: string; name: string; color: string; order: number; aiDisabled: boolean; sections: Section[] };
export type Usage = Record<"TEXT" | "AUDIO", { used: number; limit: number; left: number }>;

export type Bootstrap = {
  user: { id: string; name: string; role: "STUDENT" | "TEACHER" | "GUEST"; accessLocked: boolean; classrooms: { id: string; name: string }[]; canLink: boolean; guest?: boolean };
  notebooks: Notebook[];
  counts: { inbox: number; pinned: number; archived: number; trash: number; overdue: number; today: number; studyDue: number; sharedIn: number };
  reminders: { id: string; title: string; remindAt: string }[];
  tags: { tag: string; n: number }[];
  usage: Usage;
  storage: { used: number; quota: number };
};

export type PageItem = {
  id: string; title: string; excerpt: string; tags: string[]; color: string | null; pinned: boolean;
  sectionId: string | null; parentId: string | null; order: number; wordCount: number; remindAt: string | null;
  archivedAt: string | null; deletedAt: string | null; updatedAt: string; createdAt: string; template: string | null; studyDueAt: string | null;
};

export type Attachment = { id: string; kind: "IMAGE" | "AUDIO" | "FILE"; name: string; mime: string; size: number; url: string; createdAt: string; transcript?: Segment[] | null };
export type Segment = { start: number; end: number; text: string };
export type NoteLink = { id: string; targetType: LinkType; targetId: string; label: string; classroomId: string | null; accessible: boolean; href: string | null };
export type LinkType = "CLASSROOM" | "LESSON" | "EXAM" | "IELTS_TEST" | "DOCUMENT" | "STUDENT";
export type Share = { id: string; scope: "CLASSROOM" | "TEACHER"; classroomId: string | null; teacherId: string | null; allowCopy: boolean; feedback: string | null; feedbackAt: string | null; createdAt: string; targetName: string };

export type FullPage = PageItem & {
  contentJson: JSONContent | null; version: number; studyStep: number; style: PageStyle | null;
  section: { id: string; name: string; notebook: { id: string; name: string; aiDisabled: boolean } } | null;
  attachments: Attachment[]; links: NoteLink[]; shares: Share[];
  children: { id: string; title: string }[]; backlinks: { id: string; title: string }[];
};

/** Màn hình đang xem ở cột giữa */
export type View =
  | { kind: "home" } | { kind: "inbox" } | { kind: "all" } | { kind: "pinned" } | { kind: "archived" } | { kind: "trash" }
  | { kind: "study" } | { kind: "tasks" } | { kind: "shared" } | { kind: "section"; id: string } | { kind: "tag"; tag: string };

export const LINK_TYPE_LABEL: Record<LinkType, string> = {
  CLASSROOM: "Lớp học", LESSON: "Bài học", EXAM: "Đề thi / bài tập", IELTS_TEST: "Đề IELTS", DOCUMENT: "Tài liệu", STUDENT: "Học viên",
};

export const NOTE_COLORS = ["#1E3A8A", "#3b82f6", "#0ea5e9", "#10b981", "#f9a95a", "#ef4444", "#8b5cf6", "#64748b"];
export const PAGE_COLORS = [null, "#fde68a", "#bbf7d0", "#bfdbfe", "#fecaca", "#e9d5ff", "#fed7aa", "#e2e8f0"];
