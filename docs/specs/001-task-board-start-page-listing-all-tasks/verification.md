# Verification — 001 Task board start page listing all tasks with a create form

**Result:** pass
**Commit:** 00a792a · **Base:** f87226f · **Trace:** 6/6 criteria named by tests

Cycle 2. Since cycle 1 (`1c8d584`), only the three acceptance test files changed (`git diff --stat 1c8d584..HEAD`: `tests/ac-001-board.test.tsx`, `tests/ac-001-page.test.tsx`, `tests/ac-001-route.test.ts`). The production code is unchanged, so the implementation references from cycle 1 still hold.

| Criterion | Verdict | Tests | Implementation | Notes |
|---|---|---|---|---|
| AC-001.1 | met | `tests/ac-001-page.test.tsx` "AC-001.1 shows heading Tasks and the tasks in order with due dates"; `tests/ac-001-board.test.tsx` "AC-001.1 renders the tasks in order, in a list named Tasks" | `app/page.tsx:7-8`, `app/_lib/tasks-api.ts:17-30`, `app/_components/task-board.tsx:61`, `app/_components/task-list.tsx:14-20` | The page test stubs `API_URL` and asserts the GET URL `http://api.test:9000/tasks`, exactly one h1 "Tasks", two items in the order A then B, "2026-12-01" on A and "No due date" on B (`ac-001-page.test.tsx:30-39`). |
| AC-001.2 | met | `tests/ac-001-page.test.tsx` "AC-001.2 shows No tasks yet. and the create form for an empty list"; `tests/ac-001-board.test.tsx` "AC-001.2 …" | `app/_components/task-list.tsx:10-11`, `app/_components/task-board.tsx:63-98` | Asserts "No tasks yet.", that no list is shown, and the form with "Title", "Due date" and "Add task" (`ac-001-page.test.tsx:45-50`). |
| AC-001.3 | met | `tests/ac-001-board.test.tsx` "AC-001.3 posts the task, appends the returned task last, and clears both fields", "AC-001.3 replaces No tasks yet. and sends due_date null when left empty", "AC-001.3 shows the task the server returned, not the typed values"; `tests/ac-001-route.test.ts` "AC-001.3 forwards …", "AC-001.3 sends due_date null when it is %s" | `app/_components/task-board.tsx:30-46`, `app/api/tasks/route.ts:27-36`, `app/_lib/tasks-api.ts:46-62` | Tightened. The 201 stub now returns `"Server Normalized Title"` / `"2027-01-02"` while the typed input is `"  buy milk  "` with no date. The test asserts that the entry shows the returned values and not the typed ones (`ac-001-board.test.tsx:85-94`), so code that appended the typed values would fail. The code appends the response `body` (`task-board.tsx:42-44`). The browser POST body (with a date and with `null`), the forwarded API call, the entry shown last, "No tasks yet." replaced and both fields cleared were already proven in cycle 1. |
| AC-001.4 | met | `tests/ac-001-board.test.tsx` "AC-001.4 shows the error at the field for a %s title and sends nothing" (empty, whitespace, 201 chars, 201 emoji), "AC-001.4 accepts exactly 200 …", "AC-001.4 does not use native validation attributes"; `tests/ac-001-route.test.ts` AC-001.4 cases | `app/_lib/tasks.ts:14-23`, `app/_components/task-board.tsx:23-27,77-84`, `app/api/tasks/route.ts:18-25` | Asserts the message as the field's accessible description, that both values are kept, and that neither the browser nor the route makes a fetch (`ac-001-board.test.tsx:106-112`, `ac-001-route.test.ts:63-95`). |
| AC-001.5 | met | `tests/ac-001-page.test.tsx` "AC-001.5 shows the load error, never the empty text, on %s" (503, 500, object, non-JSON, malformed entry, rejection, TimeoutError), "AC-001.5 asks the API with a timeout signal and no caching"; `tests/ac-001-board.test.tsx` AC-001.5 cases | `app/_lib/tasks-api.ts:6,16-38`, `app/_components/task-list.tsx:7-8` | Tightened. `vi.spyOn(AbortSignal, "timeout")` with `toHaveBeenCalledWith(8000)` (`ac-001-page.test.tsx:74-76`) now pins the 8-second limit. The code calls `AbortSignal.timeout(TIMEOUT_MS)` with `TIMEOUT_MS = 8000` (`tasks-api.ts:6,19`). The status, body-shape, rejection and timeout-rejection cases assert the load error and that "No tasks yet." is absent (`ac-001-page.test.tsx:63-69`). |
| AC-001.6 | met | `tests/ac-001-board.test.tsx` "AC-001.6 shows the save error, keeps values and the list on %s" (503, 502, 200, bad 201 body, network, timeout), "AC-001.6 clears an earlier save error …"; `tests/ac-001-route.test.ts` "AC-001.6 answers 502 with the save-failed message on %s" (503, 200, 422, bad body, unreachable, timeout; exactly one call), plus the 8000 assertion in "AC-001.3 forwards …" | `app/_lib/tasks-api.ts:41-71`, `app/api/tasks/route.ts:32-35`, `app/_components/task-board.tsx:47-55,99-103` | Tightened. The POST call's `AbortSignal.timeout` spy expects `8000` (`ac-001-route.test.ts:32-34`), and the code matches (`tasks-api.ts:51`). One limitation: that assertion sits in a test named AC-001.3, not AC-001.6. The timeout behaviour itself (a `TimeoutError` leads to a 502 and the save message) is in the AC-001.6 tests, so the criterion is proven across the file. It is a naming detail, not a gap. |

## Non-goals

The spec lists no non-goals. Nothing outside the spec was implemented: no Server Actions, no client-side API access, no new dependency. The template-owned layout (`app/layout.tsx`, `site-header.tsx`, `site-footer.tsx`) is unchanged, so header, footer and navigation are untouched. ✔

## Deviations from the plan

- `docs/adr/001-server-side-api-access.md` is in no task's `files`. It was written in the design phase and `design.md` links to it. Acceptable.
- `docs/backlog.md` is in no task's `files`. It is the generated index and shows `approved` while the spec is `building`, so it is stale. Acceptable: the next `cplat spec index` run regenerates it.
- `tests/ac-001-*.test.ts[x]` come from the red commit and the tightening commit `00a792a`, not from a task. Acceptable.
- `tests/page.test.tsx` was deleted. t5 allows that when the acceptance tests cover the page. Acceptable.
- All five tasks have `done: true`. ✔
- Non-blocking, still open from cycle 1: the `@smoke @writes` test in `e2e/smoke.spec.ts` uses the page-wide `page.getByRole("listitem").last()`, which also matches the header's nav items. That makes it depend on the template's markup (#478 pattern). It should be scoped to `page.getByRole("list", { name: "Tasks" })`. It is not an acceptance test and does not affect the result.
- Test hygiene, non-blocking: the new `AbortSignal.timeout` spies are never restored (`afterEach` only unstubs globals and env). `spyOn` calls through to the real function, so behaviour is unaffected.

## Contract

Matches `design.md` (code unchanged since cycle 1):

- `tasks.ts`: signatures, `MESSAGES`, `TITLE_MAX`, the code-point count.
- `tasks-api.ts`: `API_URL` read per call, default `http://localhost:8080`, one trailing slash stripped, 8 s timeout on both calls, `no-store`, no retry, never throws, structured logs without the response body.
- Route: `422` / `201` / `502` and the `due_date` mapping.
- `page.tsx`: `force-dynamic`, passes `initialTasks`.
- `TaskBoard` DOM: h1 id, `aria-labelledby`, `noValidate` form with `aria-label`, no `required` or `maxLength`, field error through `aria-invalid` / `aria-describedby`, button disabled while a request is in flight, save alert, 10 s browser timeout, no append after a failed load. ✔

## Suppressions in acceptance tests

None (`SUPPRESSIONS: none`).

## Tightened acceptance tests

| File | Reason | Asserts the criterion as written |
|---|---|---|
| `tests/ac-001-board.test.tsx` | AC-001.3: the stubbed 201 (`"Server Normalized Title"`, `"2027-01-02"`) now differs from the typed input (`"  buy milk  "`, no date). The test asserts the entry shows the returned title and due date and not the typed values (lines 85-94). | yes |
| `tests/ac-001-page.test.tsx` | AC-001.5: spies on `AbortSignal.timeout` and expects `8000` for GET /tasks (lines 74-76). | yes |
| `tests/ac-001-route.test.ts` | AC-001.6: spies on `AbortSignal.timeout` and expects `8000` for POST /tasks (lines 32-34), inside the test named AC-001.3. | yes (assertion lives in an AC-001.3-named test; timeout behaviour itself is in the AC-001.6 cases) |

## Mutation check (report only)

Skipped: no mutation check for shape web-nextjs yet.
