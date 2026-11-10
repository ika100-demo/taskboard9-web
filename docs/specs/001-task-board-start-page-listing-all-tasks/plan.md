---
spec_id: 001-task-board-start-page-listing-all-tasks
shape: web-nextjs
spec_hash: 3802620b382f
summary: Start page lists all tasks from taskboard9-api and adds tasks through a server-side create route
tasks:
  - id: t1
    title: Add shared task module (type, texts, title check, response check)
    files: [app/_lib/tasks.ts]
    covers: [AC-001.1, AC-001.4]
    parallel_safe: true
    depends_on: []
    done: true
  - id: t2
    title: Add server-side taskboard9-api client and document API_URL
    files: [app/_lib/tasks-api.ts, docs/env-vars.md]
    covers: [AC-001.1, AC-001.3, AC-001.5, AC-001.6]
    parallel_safe: true
    depends_on: [t1]
    done: true
  - id: t3
    title: Add POST /api/tasks route handler
    files: [app/api/tasks/route.ts]
    covers: [AC-001.3, AC-001.4, AC-001.6]
    parallel_safe: true
    depends_on: [t1, t2]
    done: true
  - id: t4
    title: Add TaskBoard client component with list and create form
    files: [app/_components/task-board.tsx, app/_components/task-list.tsx, app/globals.css]
    covers: [AC-001.1, AC-001.2, AC-001.3, AC-001.4, AC-001.5, AC-001.6]
    parallel_safe: true
    depends_on: [t1]
    done: true
  - id: t5
    title: Replace the landing page with the dynamic task board page
    files: [app/page.tsx, app/_components/feature-card.tsx, app/_components/icons.tsx, tests/page.test.tsx, e2e/home.spec.ts, e2e/smoke.spec.ts]
    covers: [AC-001.1, AC-001.2, AC-001.5]
    parallel_safe: true
    depends_on: [t2, t4]
    done: true
---

# Plan — 001 Task board start page listing all tasks with a create form

Levels: t1 → t2, t4 → t3, t5. Contract and DOM shapes: [design.md](design.md). No gitops task: the system plan
already wires `API_URL=http://taskboard9-api` for this component.

## t1 — Add shared task module (type, texts, title check, response check)

**Files:** app/_lib/tasks.ts
**Covers:** AC-001.1, AC-001.4
**Goal:** one dependency-free module, importable from client and server, that holds the `Task` type, every
user-facing text, the title check and the response-shape check exactly as in design.md "app/_lib/tasks.ts".

**Implementation notes:**
- Export `Task`, `MESSAGES`, `TITLE_MAX`, `validateTitle`, `isTask`, `parseTaskList` with the signatures in design.md.
- `validateTitle` trims (`String.prototype.trim`), counts code points with `[...trimmed].length`, returns the trimmed title.
- `isTask`: plain non-null object, `id` non-empty string, `title` string, `due_date` `null` or a `YYYY-MM-DD` string.
- `parseTaskList`: `null` unless an array whose every entry passes `isTask`; maps entries to exactly `{ id, title, due_date }`.
- No imports from `next/*`, no `process.env`, no I/O.

**Done when:** `devbox run typecheck` is clean and the unit tests of the title check (empty, whitespace, 200 vs 201
code points including astral characters) and of the list check pass.

## t2 — Add server-side taskboard9-api client and document API_URL

**Files:** app/_lib/tasks-api.ts, docs/env-vars.md
**Covers:** AC-001.1, AC-001.3, AC-001.5, AC-001.6
**Goal:** the only module that talks to taskboard9-api, per design.md "app/_lib/tasks-api.ts" and ADR-001.

**Implementation notes:**
- `apiBaseUrl()` reads `process.env.API_URL` on every call, default `http://localhost:8080`, strips one trailing `/`.
- `listTasks()`: `fetch(`${base}/tasks`, { cache: "no-store", signal: AbortSignal.timeout(8000) })`; ok only for
  `200` and `parseTaskList(await res.json())` non-null; everything else (other status, JSON error, rejected fetch) is `{ ok: false }`.
- `createTask(input)`: `POST` with `Content-Type: application/json` and body `JSON.stringify({ title, due_date })`
  exactly; `Task` only for `201` with `isTask(body)`; else `null`. No retry.
- Neither function throws; each failure logs one structured `console.error({ msg, op, status | error })`, never the response body.
- Never import this module from a `"use client"` file.
- `docs/env-vars.md`: add `API_URL` under Core: default `http://localhost:8080`, base URL of taskboard9-api, no
  trailing slash, server-side only, read per request; deployed value `http://taskboard9-api` from the gitops repo.

**Done when:** the acceptance tests that stub `fetch` for the load path (AC-001.1 data, AC-001.5 failures:
503, 500, non-array body, rejected fetch, timeout signal) pass at the client level, and typecheck is clean.

## t3 — Add POST /api/tasks route handler

**Files:** app/api/tasks/route.ts
**Covers:** AC-001.3, AC-001.4, AC-001.6
**Goal:** the web-internal create route exactly as the table in design.md "POST /api/tasks".

**Implementation notes:**
- `export const dynamic = "force-dynamic"`; `export async function POST(request: Request)`.
- Parse JSON defensively; a parse failure or non-object body is treated as a missing title.
- `validateTitle` from t1; failure → `422 {"field": "title", "message": <message>}` and no API call.
- `due_date`: the request's value when it is a non-empty string, otherwise `null`.
- `createTask` from t2: Task → `201` with it; `null` → `502 {"message": MESSAGES.saveFailed}`.
- Use `NextResponse.json(body, { status })` like the existing routes.

**Done when:** the route acceptance tests for AC-001.3 (API receives `POST /tasks` with
`{"title": "Buy milk", "due_date": "2026-12-01"}` and with `"due_date": null`), AC-001.4 (422 and no `fetch`
call) and AC-001.6 (502 on 503, unreachable, timeout) pass.

## t4 — Add TaskBoard client component with list and create form

**Files:** app/_components/task-board.tsx, app/_components/task-list.tsx, app/globals.css
**Covers:** AC-001.1, AC-001.2, AC-001.3, AC-001.4, AC-001.5, AC-001.6
**Goal:** the interactive board with the DOM and submit flow fixed in design.md "TaskBoard".

**Implementation notes:**
- `task-list.tsx` (no `"use client"`, no state): `TaskList({ tasks }: { tasks: Task[] | null })` renders the
  `<ul aria-labelledby="tasks-heading">`, "No tasks yet." or the `role="alert"` load error.
- `task-board.tsx` (`"use client"`): renders `<h1 id="tasks-heading">Tasks</h1>`, `<TaskList>` and the form;
  state: `tasks`, `title`, `dueDate`, `titleError`, `saveError`, `pending`.
- Form `noValidate`, `aria-label="Add a task"`; labels "Title" / "Due date"; no `required`/`maxLength`; button
  "Add task" `disabled={pending}`.
- Title error under the input with `id="task-title-error"`, input `aria-invalid` + `aria-describedby`.
- Submit flow as the design pseudocode: client check first (no request on failure); `fetch("/api/tasks")` with
  `AbortSignal.timeout(10000)`; append the returned task (only when the list loaded) and clear both fields on
  `201`; field message on a `422` title body; save error otherwise, values kept, list unchanged.
- Import only from `app/_lib/tasks.ts`, never from `tasks-api.ts`.
- `globals.css`: small additions (`.task-list`, `.task-due`, `.task-form`, `.field-error`, `.alert`) using the
  existing design tokens; the 375 px layout must not scroll horizontally.

**Done when:** the Testing Library acceptance tests for the board (AC-001.1 to AC-001.6 at component level, with
`fetch` stubbed for `/api/tasks`) pass and `devbox run quality` is clean.

## t5 — Replace the landing page with the dynamic task board page

**Files:** app/page.tsx, app/_components/feature-card.tsx, app/_components/icons.tsx, tests/page.test.tsx, e2e/home.spec.ts, e2e/smoke.spec.ts
**Covers:** AC-001.1, AC-001.2, AC-001.5
**Goal:** `/` becomes the task board, rendered per request, never prerendered; template leftovers go.

**Implementation notes:**
- `app/page.tsx`: `export const dynamic = "force-dynamic"`; `export default async function HomePage()` calls
  `listTasks()` and returns `<TaskBoard initialTasks={result.ok ? result.tasks : null} />`.
- Delete `app/_components/feature-card.tsx` and `app/_components/icons.tsx` (only the old landing page used them;
  left in place they count as uncovered code under `app/**`).
- `tests/page.test.tsx`: replace the template assertions (they test the removed landing page) with a short test
  of `render(await HomePage())` with `fetch` stubbed, or delete it if the acceptance tests already cover the page.
- `e2e/home.spec.ts`: heading level 1 "Tasks" instead of "taskboard9-web"; drop the "Check health" link check and
  keep the `/api/health` request check; keep the 404 and phone-width tests.
- `e2e/smoke.spec.ts`: keep the template test; add the read-only `@smoke` and the `@smoke @writes`
  (`smoke-<uuid>` via `crypto.randomUUID()`) tests described in design.md "Testing notes".

**Done when:** all acceptance tests pass, `devbox run ci` is green (coverage at least 80%), and `devbox run build`
succeeds without calling the API (the route `/` is reported as dynamic).
