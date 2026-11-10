# ADR-001: The browser talks only to the web; the web calls taskboard9-api server-side

## Status

Accepted (spec 001-task-board-start-page-listing-all-tasks).

## Context

taskboard9-web is the first consumer of taskboard9-api. The API URL (`http://taskboard9-api`) is a cluster-internal
address that a browser cannot reach, and the system contract (system plan 001) makes the web the consumer "server
side only": `API_URL` is never `NEXT_PUBLIC_*`, and the web shows only its own texts, never the API's error bodies.
Every later feature that reads or writes API data faces the same choice, so it is decided once here.

## Decision

- Reads happen in Server Components, per request (`dynamic = "force-dynamic"`, `fetch` with `cache: "no-store"`).
- Writes from the browser go to a route handler of the web under `app/api/<resource>/route.ts`, which validates the
  input with the same module the form uses, calls the API and maps every API failure to one web-owned error body.
- All calls to the API go through one server-only client module (`app/_lib/tasks-api.ts` today): it reads `API_URL`
  at request time (default `http://localhost:8080`), applies the 8-second timeout, never retries a `POST`, and
  validates the response shape before anything is rendered.
- Client components never import the API client and never see `API_URL`.

## Consequences

- The API stays cluster-internal; no CORS, no public API exposure, no secret in the client bundle.
- Each write costs one extra hop (browser to web to API); acceptable for a form-driven UI.
- Server Actions are not used for writes: a route handler gives the explicit status codes and JSON bodies the
  system contract fixes (`201` / `422` / `502`) and is testable without a running Next.js server.
- New API resources add a function to the client module and, for writes, one route handler; they do not add a
  second way of reaching the API.
