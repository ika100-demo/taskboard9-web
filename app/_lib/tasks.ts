export type Task = { id: string; title: string; due_date: string | null };

export const MESSAGES = {
  titleRequired: "Title is required.",
  titleTooLong: "Title must be at most 200 characters.",
  loadFailed: "Tasks could not be loaded. Please try again later.",
  saveFailed: "The task could not be saved. Please try again.",
  empty: "No tasks yet.",
  noDueDate: "No due date",
} as const;

export const TITLE_MAX = 200; // Unicode code points, after trim

export function validateTitle(
  raw: string,
): { ok: true; title: string } | { ok: false; message: string } {
  const trimmed = raw.trim();
  if (trimmed === "") return { ok: false, message: MESSAGES.titleRequired };
  if ([...trimmed].length > TITLE_MAX) {
    return { ok: false, message: MESSAGES.titleTooLong };
  }
  return { ok: true, title: trimmed };
}

export function isTask(value: unknown): value is Task {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    v.id !== "" &&
    typeof v.title === "string" &&
    (v.due_date === null ||
      (typeof v.due_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.due_date)))
  );
}

export function parseTaskList(value: unknown): Task[] | null {
  if (!Array.isArray(value) || !value.every(isTask)) return null;
  return value.map((t) => ({ id: t.id, title: t.title, due_date: t.due_date }));
}
