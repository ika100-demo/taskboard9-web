# Design — 001 Task board start page listing all tasks with a create form

The system contract in `spec.md` (Task object, `GET /tasks`, `POST /tasks`, errors, timeouts, web-internal route)
is binding and is not repeated here; this file fixes how the web implements it and the exact shapes the
acceptance tests can rely on.

## Decisions

- The browser never calls taskboard9-api. The start page loads tasks in a Server Component per request; the form
  posts to the web's own route `POST /api/tasks`, which calls the API server-side. ADR:
  [docs/adr/001-server-side-api-access.md](../../adr/001-server-side-api-access.md).
- One shared, dependency-free module (`app/_lib/tasks.ts`) holds the Task type, the user-facing texts, the title
  check and the response-shape check. The form and the route import the same check, so the browser and the server
  can never disagree on "Title is required." / "Title must be at most 200 characters." (AC-001.4).
- No new dependency: the response-shape check is a hand-written type guard (three fields), not a schema library.
- The page renders dynamically: `export const dynamic = "force-dynamic"` on `app/page.tsx` and `cache: "no-store"`
  on the fetch, so `next build` never prerenders it and never calls the API at build time.
- When the list failed to load, a successful create clears the fields and leaves the load error in place; the
  created task is not shown, because showing one task where the board could not be loaded would look like the
  whole board (spec: "the load error stays until the page is reloaded").
- The title input carries no `required` or `maxLength` attribute and the form is `noValidate`: native browser
  validation would block the submit and the spec's own messages would never appear (AC-001.4).

## Modules

| Module | Responsibility | New / changed |
|---|---|---|
| `app/_lib/tasks.ts` | `Task` type, `MESSAGES`, `validateTitle`, `isTask`, `parseTaskList`; no I/O, safe on client and server | new |
| `app/_lib/tasks-api.ts` | server-only API client: `apiBaseUrl`, `listTasks`, `createTask` | new |
| `app/api/tasks/route.ts` | `POST /api/tasks`: validate, call `createTask`, map to `201` / `422` / `502` | new |
| `app/_components/task-list.tsx` | presentational: list, "No tasks yet." or the load error | new |
| `app/_components/task-board.tsx` | `"use client"`: heading, list state, create form, submit flow | new |
| `app/page.tsx` | async Server Component: `listTasks()` then `<TaskBoard>`; replaces the template landing page | changed |
| `app/_components/feature-card.tsx`, `app/_components/icons.tsx` | template landing-page parts, unused afterwards | removed |
| `docs/env-vars.md` | documents `API_URL` | changed |

## Contract

### `app/_lib/tasks.ts` (shared)

```ts
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

// trims; empty -> titleRequired; [...trimmed].length > 200 -> titleTooLong
export function validateTitle(raw: string):
  | { ok: true; title: string }            // title is the trimmed value
  | { ok: false; message: string };        // one of the two title messages

// true iff: plain object, id non-empty string, title string, due_date null or /^\d{4}-\d{2}-\d{2}$/ string
export function isTask(value: unknown): value is Task;

// Array.isArray and every entry isTask -> Task[] (each reduced to exactly id/title/due_date); otherwise null
export function parseTaskList(value: unknown): Task[] | null;
```

### `app/_lib/tasks-api.ts` (server only; never imported by a `"use client"` module)

```ts
// process.env.API_URL read on every call (not at module load); default "http://localhost:8080";
// one trailing "/" is stripped defensively
export function apiBaseUrl(): string;

// GET `${apiBaseUrl()}/tasks`, { cache: "no-store", signal: AbortSignal.timeout(8000) }
// ok only for status 200 with a body that parseTaskList accepts; any other status, a non-JSON body,
// a rejected fetch (connection error, timeout) -> { ok: false }. Never throws.
export async function listTasks(): Promise<{ ok: true; tasks: Task[] } | { ok: false }>;

// POST `${apiBaseUrl()}/tasks`, headers {"Content-Type": "application/json"},
// body JSON.stringify({ title, due_date }) exactly, { cache: "no-store", signal: AbortSignal.timeout(8000) }
// returns the Task for status 201 with a body isTask accepts; null for anything else. No retry. Never throws.
export async function createTask(input: { title: string; due_date: string | null }): Promise<Task | null>;
```

Failures are logged server-side as one structured line (`console.error` with `{ msg, op, status | error }`);
the API's body text is never passed to the browser.

### `POST /api/tasks` (web-internal route, `app/api/tasks/route.ts`)

`export const dynamic = "force-dynamic"`, `export async function POST(request: Request): Promise<Response>`.

| Input | Response |
|---|---|
| body not JSON, not an object, `title` absent or not a string, or empty/whitespace after trim | `422` `{"field": "title", "message": "Title is required."}`; no API call |
| `title` over 200 code points after trim | `422` `{"field": "title", "message": "Title must be at most 200 characters."}`; no API call |
| valid title; `createTask` returns a Task | `201` with that Task object (`{"id", "title", "due_date"}`) |
| valid title; `createTask` returns null (API non-201, 422, 5xx, unreachable, timeout, bad body) | `502` `{"message": "The task could not be saved. Please try again."}` |

The body sent to the API is exactly `{"title": <trimmed title>, "due_date": <value>}`, where `<value>` is the
request's `due_date` when it is a non-empty string and `null` otherwise (absent, `null`, `""`, any other type).
All responses are `application/json`.

### `app/page.tsx`

`export const dynamic = "force-dynamic"`; `export default async function HomePage()` (no props) calls
`listTasks()` and returns `<TaskBoard initialTasks={result.ok ? result.tasks : null} />`. Testable as
`render(await HomePage())` with `fetch` stubbed (`vi.stubGlobal("fetch", ...)`).

### `TaskBoard` (`app/_components/task-board.tsx`, `"use client"`)

`export function TaskBoard({ initialTasks }: { initialTasks: Task[] | null })` — `null` means the load failed.

DOM the acceptance tests can rely on (by role and text, inside `<main>`):

- `<h1 id="tasks-heading">Tasks</h1>`: the page's only level-1 heading (AC-001.1).
- Loaded with tasks: `<ul aria-labelledby="tasks-heading">` (role `list`, name "Tasks"), one `<li>` per task in
  array order; each `<li>` contains the title and, as separate text, the `due_date` verbatim or "No due date"
  (AC-001.1).
- Loaded, empty: `<p>No tasks yet.</p>` and no task list (AC-001.2).
- Load failed: `<p role="alert">Tasks could not be loaded. Please try again later.</p>`, no task list and never
  "No tasks yet." (AC-001.5).
- `<form noValidate aria-label="Add a task">` (role `form`) with:
  - `<label for="task-title">Title</label><input id="task-title" name="title" type="text">`;
  - when there is a title error: `<p id="task-title-error">` with the message directly after the input, and the
    input has `aria-invalid="true"` and `aria-describedby="task-title-error"` (accessible description = message);
  - `<label for="task-due-date">Due date</label><input id="task-due-date" name="due_date" type="date">`;
  - `<button type="submit">Add task</button>`, `disabled` while a request is in flight;
  - when a save failed: `<p role="alert">The task could not be saved. Please try again.</p>` inside the form.

Submit flow (pseudocode):

```
onSubmit(e): e.preventDefault(); clear titleError and saveError
  v = validateTitle(title); if !v.ok: titleError = v.message; return        // no request (AC-001.4)
  pending = true
  try res = fetch("/api/tasks", { method: "POST", headers: {"Content-Type": "application/json"},
              body: JSON.stringify({ title: v.title, due_date: dueDate || null }),
              signal: AbortSignal.timeout(10000) })
      201 and isTask(body)                     -> if tasks !== null: tasks = [...tasks, body]; title = ""; dueDate = ""
      422 and body.field === "title" and body.message is one of the two title messages -> titleError = body.message
      anything else                            -> saveError = MESSAGES.saveFailed      // values kept (AC-001.6)
  catch (network error, abort)                 -> saveError = MESSAGES.saveFailed
  finally pending = false
```

The appended entry is the task the server returned, not the typed values (AC-001.3). Errors keep both field
values unchanged (AC-001.4, AC-001.6).

## Testing notes

- Acceptance tests run in Vitest (`tests/`): the page via `render(await HomePage())` with `fetch` stubbed,
  the route by calling `POST(new Request(...))` with `fetch` stubbed and asserting the URL
  `http://<API_URL>/tasks` and body it received, the board with Testing Library and a stubbed `fetch` for
  `/api/tasks`. Timeouts are tested by asserting the `signal` passed to `fetch` or by a stub that rejects with an
  `AbortError`/`TimeoutError`; no test waits 8 seconds.
- Playwright starts the app without an API (`API_URL` unset, nothing on `:8080`), so local e2e sees the load
  failure; e2e checks only the heading, landmarks and that the page renders. Name acceptance test files
  `tests/ac-001-*.test.ts[x]`: the template's `tests/page.test.tsx` is rewritten by t5 and is not an
  acceptance test file.
- Smoke (`e2e/smoke.spec.ts`, run by t5): keep the template check; add a read-only `@smoke` (level-1 heading
  "Tasks" visible, "Tasks could not be loaded." absent) and a `@smoke @writes` test that adds
  `smoke-<uuid>` without a due date and sees it as the last list entry with "No due date".
