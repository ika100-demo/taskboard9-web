import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function openPage() {
  const mod = await import("@/app/page");
  render(await mod.default());
}

describe("start page", () => {
  beforeEach(() => {
    vi.stubEnv("API_URL", "http://api.test:9000");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("AC-001.1 shows heading Tasks and the tasks in order with due dates", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      json([
        { id: "1", title: "A", due_date: "2026-12-01" },
        { id: "2", title: "B", due_date: null },
      ]),
    );
    vi.stubGlobal("fetch", fetchMock);
    await openPage();
    expect(String(fetchMock.mock.calls[0][0])).toBe("http://api.test:9000/tasks");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "Tasks" })).toBeInTheDocument();
    const items = within(screen.getByRole("list", { name: "Tasks" })).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("A");
    expect(items[0]).toHaveTextContent("2026-12-01");
    expect(items[1]).toHaveTextContent("B");
    expect(items[1]).toHaveTextContent("No due date");
    expect(items[0]).not.toHaveTextContent("No due date");
  });

  it("AC-001.2 shows No tasks yet. and the create form for an empty list", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json([])));
    await openPage();
    expect(screen.getByText("No tasks yet.")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Tasks" })).not.toBeInTheDocument();
    const form = screen.getByRole("form", { name: "Add a task" });
    expect(within(form).getByLabelText("Title")).toBeInTheDocument();
    expect(within(form).getByLabelText("Due date")).toBeInTheDocument();
    expect(within(form).getByRole("button", { name: "Add task" })).toBeInTheDocument();
  });

  const failures: Array<[string, () => ReturnType<typeof vi.fn>]> = [
    ["503", () => vi.fn().mockResolvedValue(json({ error: "x" }, 503))],
    ["500", () => vi.fn().mockResolvedValue(json([], 500))],
    ["200 with a JSON object", () => vi.fn().mockResolvedValue(json({ tasks: [] }))],
    ["200 with a non-JSON body", () => vi.fn().mockResolvedValue(new Response("<html>", { status: 200 }))],
    ["200 with a malformed entry", () => vi.fn().mockResolvedValue(json([{ id: "1", title: 5, due_date: null }]))],
    ["network rejection", () => vi.fn().mockRejectedValue(new TypeError("fetch failed"))],
    ["timeout", () => vi.fn().mockRejectedValue(new DOMException("timed out", "TimeoutError"))],
  ];

  it.each(failures)("AC-001.5 shows the load error, never the empty text, on %s", async (_name, make) => {
    vi.stubGlobal("fetch", make());
    await openPage();
    expect(screen.getByText("Tasks could not be loaded. Please try again later.")).toBeInTheDocument();
    expect(screen.queryByText("No tasks yet.")).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Tasks" })).not.toBeInTheDocument();
  });

  it("AC-001.5 asks the API with a timeout signal and no caching", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json([]));
    vi.stubGlobal("fetch", fetchMock);
    await openPage();
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.cache).toBe("no-store");
  });
});
