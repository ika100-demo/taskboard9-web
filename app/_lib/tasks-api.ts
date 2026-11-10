// Server-side only: the single module that talks to taskboard9-api.
// Never import it from a "use client" file.
import { isTask, parseTaskList } from "./tasks";
import type { Task } from "./tasks";

const TIMEOUT_MS = 8000;

export function apiBaseUrl(): string {
  const raw = process.env.API_URL || "http://localhost:8080";
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

export async function listTasks(): Promise<
  { ok: true; tasks: Task[] } | { ok: false }
> {
  try {
    const res = await fetch(`${apiBaseUrl()}/tasks`, {
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.status !== 200) {
      console.error({ msg: "taskboard9-api request failed", op: "listTasks", status: res.status });
      return { ok: false };
    }
    const tasks = parseTaskList(await res.json());
    if (tasks === null) {
      console.error({ msg: "taskboard9-api invalid response", op: "listTasks", status: res.status });
      return { ok: false };
    }
    return { ok: true, tasks };
  } catch (err) {
    console.error({
      msg: "taskboard9-api request failed",
      op: "listTasks",
      error: err instanceof Error ? err.name : "unknown",
    });
    return { ok: false };
  }
}

export async function createTask(input: {
  title: string;
  due_date: string | null;
}): Promise<Task | null> {
  try {
    const res = await fetch(`${apiBaseUrl()}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: input.title, due_date: input.due_date }),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.status !== 201) {
      console.error({ msg: "taskboard9-api request failed", op: "createTask", status: res.status });
      return null;
    }
    const body: unknown = await res.json();
    if (!isTask(body)) {
      console.error({ msg: "taskboard9-api invalid response", op: "createTask", status: res.status });
      return null;
    }
    return { id: body.id, title: body.title, due_date: body.due_date };
  } catch (err) {
    console.error({
      msg: "taskboard9-api request failed",
      op: "createTask",
      error: err instanceof Error ? err.name : "unknown",
    });
    return null;
  }
}
