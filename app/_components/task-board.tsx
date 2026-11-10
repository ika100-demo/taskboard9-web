"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { MESSAGES, isTask, validateTitle } from "@/app/_lib/tasks";
import type { Task } from "@/app/_lib/tasks";
import { TaskList } from "./task-list";

export type TaskBoardProps = { initialTasks: Task[] | null };

export function TaskBoard({ initialTasks }: TaskBoardProps) {
  const [tasks, setTasks] = useState<Task[] | null>(initialTasks);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [titleError, setTitleError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTitleError(null);
    setSaveError(null);
    const v = validateTitle(title);
    if (!v.ok) {
      setTitleError(v.message);
      return;
    }
    setPending(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: v.title, due_date: dueDate || null }),
        signal: AbortSignal.timeout(10000),
      });
      let body: unknown = null;
      try {
        body = await res.json();
      } catch {
        body = null;
      }
      if (res.status === 201 && isTask(body)) {
        const created: Task = body;
        setTasks((current) => (current === null ? null : [...current, created]));
        setTitle("");
        setDueDate("");
      } else if (res.status === 422 && isTitleFieldError(body)) {
        setTitleError(body.message);
      } else {
        setSaveError(MESSAGES.saveFailed);
      }
    } catch {
      setSaveError(MESSAGES.saveFailed);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <h1 id="tasks-heading">Tasks</h1>
      <TaskList tasks={tasks} />
      <form
        className="task-form"
        noValidate
        aria-label="Add a task"
        onSubmit={onSubmit}
      >
        <div>
          <label htmlFor="task-title">Title</label>
          <input
            id="task-title"
            name="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-invalid={titleError ? "true" : undefined}
            aria-describedby={titleError ? "task-title-error" : undefined}
          />
          {titleError ? (
            <p id="task-title-error" className="field-error">
              {titleError}
            </p>
          ) : null}
        </div>
        <div>
          <label htmlFor="task-due-date">Due date</label>
          <input
            id="task-due-date"
            name="due_date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          Add task
        </button>
        {saveError ? (
          <p role="alert" className="alert">
            {saveError}
          </p>
        ) : null}
      </form>
    </>
  );
}

function isTitleFieldError(
  body: unknown,
): body is { field: "title"; message: string } {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    b.field === "title" &&
    (b.message === MESSAGES.titleRequired ||
      b.message === MESSAGES.titleTooLong)
  );
}
