import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Task } from "@/app/_lib/tasks";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function renderBoard(initialTasks: Task[] | null) {
  const { TaskBoard } = await import("@/app/_components/task-board");
  render(<TaskBoard initialTasks={initialTasks} />);
}

const titleInput = () => screen.getByLabelText("Title") as HTMLInputElement;
const dueInput = () => screen.getByLabelText("Due date") as HTMLInputElement;
const submit = () => fireEvent.click(screen.getByRole("button", { name: "Add task" }));
const fill = (title: string, due = "") => {
  fireEvent.change(titleInput(), { target: { value: title } });
  if (due) fireEvent.change(dueInput(), { target: { value: due } });
};
const titles = () =>
  screen.queryByRole("list", { name: "Tasks" })
    ? within(screen.getByRole("list", { name: "Tasks" })).getAllByRole("listitem")
    : [];

const A: Task = { id: "1", title: "A", due_date: "2026-12-01" };
const SAVE_FAILED = "The task could not be saved. Please try again.";

describe("task board", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("AC-001.1 renders the tasks in order, in a list named Tasks", async () => {
    await renderBoard([A, { id: "2", title: "B", due_date: null }]);
    expect(screen.getByRole("heading", { level: 1, name: "Tasks" })).toBeInTheDocument();
    const items = titles();
    expect(items.map((i) => i.textContent)).toEqual([
      expect.stringContaining("A"),
      expect.stringContaining("B"),
    ]);
    expect(items[0]).toHaveTextContent("2026-12-01");
    expect(items[1]).toHaveTextContent("No due date");
  });

  it("AC-001.2 shows the empty text and the form for an empty list", async () => {
    await renderBoard([]);
    expect(screen.getByText("No tasks yet.")).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "Add a task" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add task" })).toBeInTheDocument();
  });

  it("AC-001.3 posts the task, appends the returned task last, and clears both fields", async () => {
    fetchMock.mockResolvedValue(json({ id: "9", title: "Buy milk", due_date: "2026-12-01" }, 201));
    await renderBoard([A]);
    fill("Buy milk", "2026-12-01");
    submit();
    await waitFor(() => expect(titles()).toHaveLength(2));
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("/api/tasks");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ title: "Buy milk", due_date: "2026-12-01" });
    expect(titles()[1]).toHaveTextContent("Buy milk");
    expect(titles()[1]).toHaveTextContent("2026-12-01");
    expect(titles()[0]).toHaveTextContent("A");
    expect(titleInput().value).toBe("");
    expect(dueInput().value).toBe("");
  });

  it("AC-001.3 replaces No tasks yet. and sends due_date null when left empty", async () => {
    fetchMock.mockResolvedValue(json({ id: "9", title: "Buy milk", due_date: null }, 201));
    await renderBoard([]);
    fill("Buy milk");
    submit();
    await waitFor(() => expect(titles()).toHaveLength(1));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ title: "Buy milk", due_date: null });
    expect(titles()[0]).toHaveTextContent("No due date");
    expect(screen.queryByText("No tasks yet.")).not.toBeInTheDocument();
  });

  it("AC-001.3 shows the task the server returned, not the typed values", async () => {
    fetchMock.mockResolvedValue(json({ id: "9", title: "Buy milk", due_date: null }, 201));
    await renderBoard([]);
    fill("  Buy milk  ");
    submit();
    await waitFor(() => expect(titles()).toHaveLength(1));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).title).toBe("Buy milk");
  });

  it.each([
    ["empty", "", "Title is required."],
    ["whitespace only", "   ", "Title is required."],
    ["201 characters", "a".repeat(201), "Title must be at most 200 characters."],
    ["201 emoji", "😀".repeat(201), "Title must be at most 200 characters."],
  ])("AC-001.4 shows the error at the field for a %s title and sends nothing", async (_n, value, message) => {
    await renderBoard([A]);
    fill(value, "2026-12-01");
    submit();
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(titleInput()).toHaveAttribute("aria-invalid", "true");
    expect(titleInput()).toHaveAccessibleDescription(message);
    expect(titleInput().value).toBe(value);
    expect(dueInput().value).toBe("2026-12-01");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(titles()).toHaveLength(1);
  });

  it("AC-001.4 accepts exactly 200 characters and 200 emoji", async () => {
    fetchMock.mockResolvedValue(json({ id: "9", title: "x", due_date: null }, 201));
    await renderBoard([]);
    fill("😀".repeat(200));
    submit();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("Title must be at most 200 characters.")).not.toBeInTheDocument();
  });

  it("AC-001.4 does not use native validation attributes", async () => {
    await renderBoard([]);
    expect(titleInput()).not.toBeRequired();
    expect(titleInput()).not.toHaveAttribute("maxlength");
    expect(screen.getByRole("form", { name: "Add a task" })).toHaveAttribute("novalidate");
  });

  it("AC-001.5 shows the load error and never the empty text when the list is null", async () => {
    await renderBoard(null);
    expect(screen.getByRole("alert")).toHaveTextContent("Tasks could not be loaded. Please try again later.");
    expect(screen.queryByText("No tasks yet.")).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Tasks" })).not.toBeInTheDocument();
    expect(screen.getByRole("form", { name: "Add a task" })).toBeInTheDocument();
  });

  it("AC-001.5 keeps the load error after a successful create and does not show the task", async () => {
    fetchMock.mockResolvedValue(json({ id: "9", title: "Buy milk", due_date: null }, 201));
    await renderBoard(null);
    fill("Buy milk");
    submit();
    await waitFor(() => expect(titleInput().value).toBe(""));
    expect(screen.getByText("Tasks could not be loaded. Please try again later.")).toBeInTheDocument();
    expect(screen.queryByText("Buy milk")).not.toBeInTheDocument();
  });

  it.each([
    ["503", () => fetchMock.mockResolvedValue(json({ message: "x" }, 503))],
    ["502", () => fetchMock.mockResolvedValue(json({ message: SAVE_FAILED }, 502))],
    ["200 instead of 201", () => fetchMock.mockResolvedValue(json({ id: "1", title: "T", due_date: null }, 200))],
    ["a 201 with a bad body", () => fetchMock.mockResolvedValue(json({ nope: true }, 201))],
    ["a network error", () => fetchMock.mockRejectedValue(new TypeError("fetch failed"))],
    ["a timeout", () => fetchMock.mockRejectedValue(new DOMException("t", "TimeoutError"))],
  ])("AC-001.6 shows the save error, keeps values and the list on %s", async (_n, arrange) => {
    arrange();
    await renderBoard([A]);
    fill("Buy milk", "2026-12-01");
    submit();
    expect(await screen.findByText(SAVE_FAILED)).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(SAVE_FAILED);
    expect(titleInput().value).toBe("Buy milk");
    expect(dueInput().value).toBe("2026-12-01");
    expect(titles()).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Add task" })).toBeEnabled();
  });

  it("AC-001.6 sets a timeout signal on the browser request and disables the button while in flight", async () => {
    let resolve: (r: Response) => void = () => {};
    fetchMock.mockReturnValue(new Promise<Response>((r) => (resolve = r)));
    await renderBoard([]);
    fill("Buy milk");
    submit();
    await waitFor(() => expect(screen.getByRole("button", { name: "Add task" })).toBeDisabled());
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    resolve(json({ id: "9", title: "Buy milk", due_date: null }, 201));
    await waitFor(() => expect(screen.getByRole("button", { name: "Add task" })).toBeEnabled());
  });

  it("AC-001.6 clears an earlier save error when the next submit succeeds", async () => {
    fetchMock.mockResolvedValueOnce(json({}, 503));
    fetchMock.mockResolvedValueOnce(json({ id: "9", title: "Buy milk", due_date: null }, 201));
    await renderBoard([]);
    fill("Buy milk");
    submit();
    await screen.findByText(SAVE_FAILED);
    submit();
    await waitFor(() => expect(titles()).toHaveLength(1));
    expect(screen.queryByText(SAVE_FAILED)).not.toBeInTheDocument();
  });
});
