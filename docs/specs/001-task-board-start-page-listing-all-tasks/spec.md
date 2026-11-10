---
spec_id: 001-task-board-start-page-listing-all-tasks
title: Task board start page listing all tasks with a create form
status: done
priority: P1
shape: web-nextjs
parent: ika100-demo/taskboard9-gitops:001-persistent-tasks-in-postgres-with-a-web
---

# 001 — Task board start page listing all tasks with a create form

## Problem

The Task API keeps tasks only in its own memory, so every restart or redeploy of the API wipes the board, and the API cannot run more than one instance. The only way to see or create tasks is to call the API directly; taskboard9 has a web UI component but it has no task features yet. Storing tasks in a Postgres database and giving the web UI a task list with a create form turns taskboard9 into a board people can actually use and rely on.

## System context

Slice of the system plan `001-persistent-tasks-in-postgres-with-a-web` in `ika100-demo/taskboard9-gitops` for `taskboard9-web` (web-nextjs). The system criteria and the contract below are binding: every criterion of this spec implements one of them and names it: `(system AC-<NNN>.<n>)`.

### System criteria

- **AC-001.4** Given task "A" with due date 2026-12-01 and then task "B" without a due date were created through the API, when a person opens the web UI's start page, then it shows a list headed "Tasks" with "A" above "B", "A" showing the due date "2026-12-01" and "B" showing "No due date".
- **AC-001.5** Given no task exists, when a person opens the web UI's start page, then it shows the text "No tasks yet." in place of the list, together with the create form.
- **AC-001.6** Given the start page is open, when a person enters the title "Buy milk" and the due date 2026-12-01 and submits the form, then "Buy milk" with "2026-12-01" appears as the last entry of the list without the person reloading the page, the form fields are cleared, and the API's `GET /tasks` contains that task; submitting with the due date left empty creates the task with no due date.
- **AC-001.7** Given the start page is open, when a person submits the form with a title that is empty or whitespace only, or longer than 200 characters after trimming, then the page shows "Title is required." or "Title must be at most 200 characters." respectively at the title field, keeps the entered values, and no task is created.
- **AC-001.8** Given the API is unreachable or answers with a 5xx status, when a person opens the start page, then it shows "Tasks could not be loaded. Please try again later." instead of the list (not "No tasks yet."); and when a person submits a valid task, the page shows "The task could not be saved. Please try again." and keeps the entered values.

### Contract

The provider is `taskboard9-api`; the consumer is `taskboard9-web` (server side only). Base URL: the env var
`API_URL` of the web (`http://taskboard9-api` in the cluster, `http://localhost:8080` locally); no trailing slash,
paths are appended as written. All bodies are `application/json; charset=utf-8`. No authentication (A9).

**Task object** (unchanged from taskboard9-api spec 001)

| Field | Type | Notes |
|---|---|---|
| `id` | string | server-assigned, non-empty, opaque, unique; clients never parse it (UUID text today) |
| `title` | string | stored trimmed, 1 to 200 characters (Unicode code points) |
| `due_date` | string `YYYY-MM-DD` or `null` | calendar date, no time or zone; past dates allowed |

A task has exactly these three fields. Creation order is kept by the API internally and is not exposed.

### `GET /tasks`

- `200`: JSON array of every stored task, oldest first by creation (across restarts and instances), each exactly
  as returned by its `POST`; `[]` when there is none. No query parameters, no pagination.
- `503`: the database is unreachable or not configured; body `{"detail": "Database unavailable"}`.

### `POST /tasks`

Request body: `{"title": "Buy milk", "due_date": "2026-12-01"}`.

- `title` (required): JSON string; trimmed; 1 to 200 code points after trimming.
- `due_date` (optional): `YYYY-MM-DD` string of a real calendar date, or `null`, or absent. Unknown fields,
  including `id`, are ignored.

Responses:

- `201`: the created Task object; the returned title is the trimmed one; `due_date` is `null` when it was absent
  or `null`.
- `422`: validation failure, nothing stored; FastAPI's standard body
  `{"detail": [{"loc": ["body", "title"], "msg": "...", "type": "..."}]}`, one entry per invalid field
  (`loc` `["body", "title"]` or `["body", "due_date"]`).
- `503`: the database is unreachable or not configured; nothing stored; body `{"detail": "Database unavailable"}`.

**What the web sends.** The web trims the title and checks it before sending: empty after trimming gives
"Title is required.", more than 200 code points after trimming (`[...title].length`, not `title.length`) gives
"Title must be at most 200 characters."; then nothing is sent. The due date comes from an `<input type="date">`
whose value is already `YYYY-MM-DD`; an empty field is sent as `"due_date": null`. The body is exactly
`{"title": <trimmed title>, "due_date": <date or null>}`.

**What the web shows** (A6, A8): the heading "Tasks" (level 1); each entry shows its title and its `due_date`
verbatim (`YYYY-MM-DD`), or "No due date" when it is `null`; entries in the order of the array; "No tasks yet."
when the array is empty; "Tasks could not be loaded. Please try again later." when the list cannot be loaded;
"The task could not be saved. Please try again." when a create fails; the field messages above, shown at the
title field. The form fields are labelled "Title" and "Due date", the button is "Add task". After a 201 the
returned task (not the typed values) is appended as the last entry and both fields are cleared. When the list
failed to load, the form stays usable; a successful create then clears the fields and the load error stays until
the page is reloaded.

**Web-internal route** (not called by other repos, stated so both sides agree on the behaviour):
`POST /api/tasks` on the web takes the same body as the API, answers `201` with the API's Task object, `422`
with `{"field": "title", "message": "<one of the two field messages>"}` when its own check fails, and `502` with
`{"message": "The task could not be saved. Please try again."}` for every API failure.

**Database (inside taskboard9-api only).** Table `tasks`: `seq bigint generated always as identity primary key`,
`id uuid not null unique`, `title text not null` (check 1 to 200 characters), `due_date date null`. `GET /tasks`
orders by `seq`. The API creates the table itself, idempotently and safely with several instances starting at
once (`CREATE TABLE IF NOT EXISTS` under an advisory lock), at startup when the database is reachable and
otherwise before the first request that reaches it. The database starts empty (A3).

### Errors

- Error bodies are JSON with a `detail` key: an array of field entries for `422` (FastAPI's shape), a string for
  `503`. The `detail` text is informative; no caller matches on it.
- The web never shows the API's error text to a person; it shows only the texts listed above.
- `GET /tasks`: anything other than `200` with a JSON array (any 4xx or 5xx, a body that is not a JSON array,
  a connection error, a timeout) is a load failure: the page shows "Tasks could not be loaded. Please try
  again later." and never "No tasks yet.". Entries with missing fields are not repaired; the whole load fails.
- `POST /tasks`: anything other than `201` with a Task object (including `422`, which the web's own check
  should make impossible, any other 4xx, any 5xx, a connection error, a timeout) is a save failure: the page
  shows "The task could not be saved. Please try again.", keeps the entered values and leaves the list unchanged.
  The web does not retry a `POST` by itself, so a lost answer can never create the task twice.
- The API answers `500` only for a bug; a database that is down, refusing connections, not configured, or too
  slow (over its timeouts below) is always `503`, with nothing stored.

### Timeouts

- **Web to API** (`GET /tasks`, `POST /tasks`, server side): 8 seconds each (`AbortSignal.timeout(8000)`); on
  expiry the web treats the call as failed (load or save failure above). No retries.
- **Browser to web** (`POST /api/tasks`): the client aborts after 10 seconds and shows the save failure; the
  submit button is disabled while a request is in flight so one press sends one request.
- **API to Postgres**: connect timeout 2 seconds, pool checkout timeout 2 seconds, `statement_timeout` 3 seconds;
  so the API answers `503` within 5 seconds when the database is down or slow, before the web's 8 seconds run out.
- **Recovery**: the API keeps no "database down" state; every request tries the pool, which replaces broken
  connections, so requests succeed again as soon as the database accepts connections, well within the 30 seconds
  of AC-001.3. Liveness (`/health`) and readiness (`/ready`) never touch the database.
- **Startup**: the API starts and becomes ready even when the database is unreachable (task endpoints answer
  `503` until it is reachable); the web starts without the API (the page shows the load failure).

### Provided by the system

The gitops part of this plan wires these for this repo; rely on them, do not ask for them again:

- env `API_URL=http://taskboard9-api`

### Notes for this repo

The start page replaces the template's landing content and must render per request (dynamic, fetch
with cache: "no-store"), never prerendered at build time. API_URL is server-side only (never
NEXT_PUBLIC_*), read at request time, default http://localhost:8080; document it in docs/env-vars.md.
Keep the template's smoke test (a level-1 heading); add a read-only @smoke (heading "Tasks", no load
error) and a @smoke @writes test creating a smoke-<uuid> task (dev only).

## Stories

<!-- As a <persona>, I want <goal>, so that <benefit>. -->

## Acceptance criteria

- **AC-001.1** Given API_URL points at an API whose GET /tasks answers 200 with [{"id": "1", "title": "A", "due_date": "2026-12-01"}, {"id": "2", "title": "B", "due_date": null}], when a person opens the start page /, then it shows a level-1 heading "Tasks" and a list with "A" above "B", "A" showing "2026-12-01" and "B" showing "No due date" (system AC-001.4)
- **AC-001.2** Given GET /tasks answers 200 with [], when a person opens /, then it shows the text "No tasks yet." in place of the list, together with the create form (field "Title", field "Due date", button "Add task") (system AC-001.5)
- **AC-001.3** Given the start page is open, when a person enters the title "Buy milk" and the due date 2026-12-01 and presses "Add task", then the API receives POST /tasks {"title": "Buy milk", "due_date": "2026-12-01"}, and after its 201 the returned task appears as the last list entry with "2026-12-01" without a page reload (replacing "No tasks yet." when the list was empty) and both fields are empty; with the due date left empty the body carries "due_date": null and the entry shows "No due date" (system AC-001.6)
- **AC-001.4** Given the start page is open, when a person submits a title that is empty or whitespace only, or longer than 200 characters after trimming, then the page shows "Title is required." or "Title must be at most 200 characters." respectively at the title field, keeps the entered title and due date, and sends no POST /tasks to the API (system AC-001.7)
- **AC-001.5** Given GET /tasks cannot be reached, gives no answer within 8 seconds, or answers anything but 200 with a JSON array (for example 503 or 500), when a person opens /, then the page shows "Tasks could not be loaded. Please try again later." instead of the list and never "No tasks yet." (system AC-001.8)
- **AC-001.6** Given the start page is open, when a person submits a valid task and POST /tasks cannot be reached, gives no answer within 8 seconds, or answers anything but 201 (for example 503), then the page shows "The task could not be saved. Please try again.", keeps the entered title and due date, and the list is unchanged (system AC-001.8)

## Non-goals

## Assumptions

<!-- Spec 149: decisions taken by default, approved with the spec. One bullet each: - **A1** <the decision> (other option: <…>; affects AC-…). A revised one is struck through (~~…~~), never deleted. -->

## Open questions

<!-- Only what may not be decided by default (spec 149): security or access, money, destroying or migrating data, or a request too ambiguous to build. Approval is refused while any is open. Strike answered ones (~~…~~) and fold the answer into the criteria. -->

## Changelog

- 2026-11-10 created from the system plan, with its criteria (spec 147)
- 2026-11-10 approved
- 2026-11-10 building
- 2026-11-10 done
