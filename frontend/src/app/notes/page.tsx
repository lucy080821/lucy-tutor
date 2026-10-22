"use client";
import { Suspense } from "react";
import NotesApp from "@/components/notes/NotesApp";

// Lucy Notes — xem CLAUDE.md mục "Lucy Notes". NotesApp đọc ?v=&p= nên phải nằm trong Suspense (useSearchParams).
export default function NotesPage() {
  return (
    <Suspense fallback={null}>
      <NotesApp />
    </Suspense>
  );
}
