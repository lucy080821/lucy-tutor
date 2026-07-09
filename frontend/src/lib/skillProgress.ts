const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export type Skill = "READING" | "LISTENING" | "SPEAKING" | "WRITING";

// Best-effort logging for the dashboard's 4-skill radar chart — never blocks or
// surfaces errors to the student, a failed log just means one fewer data point.
// score is a plain 0-10 estimate, not tied to any specific exam's grading scale.
export function logSkillProgress(userId: string | null, skill: Skill, score: number, source: string) {
  if (!userId) return;
  fetch(`${API}/api/skill-progress/log`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, skill, score, source })
  }).catch(() => {});
}
