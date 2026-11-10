import { NextResponse } from "next/server";
import { MESSAGES, validateTitle } from "@/app/_lib/tasks";
import { createTask } from "@/app/_lib/tasks-api";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  let body: Record<string, unknown> = {};
  try {
    const parsed: unknown = await request.json();
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      body = parsed as Record<string, unknown>;
    }
  } catch {
    // treated as a missing title
  }

  const rawTitle = typeof body.title === "string" ? body.title : "";
  const result = validateTitle(rawTitle);
  if (!result.ok) {
    return NextResponse.json(
      { field: "title", message: result.message },
      { status: 422 },
    );
  }

  const dueDate =
    typeof body.due_date === "string" && body.due_date !== ""
      ? body.due_date
      : null;

  const task = await createTask({ title: result.title, due_date: dueDate });
  if (task === null) {
    return NextResponse.json({ message: MESSAGES.saveFailed }, { status: 502 });
  }
  return NextResponse.json(task, { status: 201 });
}
