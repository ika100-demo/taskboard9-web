import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const post = async (body: unknown, raw = false) => {
  const { POST } = await import("@/app/api/tasks/route");
  return POST(
    new Request("http://localhost/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: raw ? (body as string) : JSON.stringify(body),
    }),
  );
};

describe("POST /api/tasks", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.stubEnv("API_URL", "http://api.test:9000/");
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("AC-001.3 forwards the trimmed title and due date to the API and returns the created task", async () => {
    const created = { id: "7", title: "Buy milk", due_date: "2026-12-01" };
    fetchMock.mockResolvedValue(json(created, 201));
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout");
    const res = await post({ title: "  Buy milk ", due_date: "2026-12-01" });
    expect(timeoutSpy).toHaveBeenCalledWith(8000);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual(created);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("http://api.test:9000/tasks");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ "Content-Type": "application/json" });
    expect(JSON.parse(init.body)).toEqual({ title: "Buy milk", due_date: "2026-12-01" });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it.each([["missing", undefined], ["empty", ""], ["null", null]])(
    "AC-001.3 sends due_date null when it is %s",
    async (_n, due) => {
      fetchMock.mockResolvedValue(json({ id: "8", title: "X", due_date: null }, 201));
      const body: Record<string, unknown> = { title: "X" };
      if (due !== undefined) body.due_date = due;
      const res = await post(body);
      expect(res.status).toBe(201);
      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ title: "X", due_date: null });
    },
  );

  it.each([
    ["empty", { title: "" }],
    ["whitespace", { title: "   \t " }],
    ["absent", { due_date: "2026-12-01" }],
    ["not a string", { title: 5 }],
    ["a non-object body", [1, 2]],
  ])("AC-001.4 answers 422 Title is required. for a %s title and calls no API", async (_n, body) => {
    const res = await post(body);
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ field: "title", message: "Title is required." });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("AC-001.4 answers 422 Title is required. for a body that is not JSON", async () => {
    const res = await post("{nope", true);
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ field: "title", message: "Title is required." });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("AC-001.4 rejects a title of 201 code points and accepts 200 (trimmed)", async () => {
    const tooLong = await post({ title: "a".repeat(201) });
    expect(tooLong.status).toBe(422);
    expect(await tooLong.json()).toEqual({ field: "title", message: "Title must be at most 200 characters." });
    expect(fetchMock).not.toHaveBeenCalled();

    fetchMock.mockResolvedValue(json({ id: "9", title: "a".repeat(200), due_date: null }, 201));
    const ok = await post({ title: ` ${"a".repeat(200)} ` });
    expect(ok.status).toBe(201);
  });

  it("AC-001.4 counts code points, so 200 emoji pass and 201 fail", async () => {
    const two = "😀".repeat(200); // 400 UTF-16 units
    fetchMock.mockResolvedValue(json({ id: "9", title: two, due_date: null }, 201));
    expect((await post({ title: two })).status).toBe(201);
    fetchMock.mockClear();
    const res = await post({ title: "😀".repeat(201) });
    expect(res.status).toBe(422);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["503", () => fetchMock.mockResolvedValue(json({}, 503))],
    ["200 instead of 201", () => fetchMock.mockResolvedValue(json({ id: "1", title: "X", due_date: null }, 200))],
    ["422 from the API", () => fetchMock.mockResolvedValue(json({}, 422))],
    ["a 201 with a bad body", () => fetchMock.mockResolvedValue(json({ nope: 1 }, 201))],
    ["unreachable", () => fetchMock.mockRejectedValue(new TypeError("fetch failed"))],
    ["timeout", () => fetchMock.mockRejectedValue(new DOMException("t", "TimeoutError"))],
  ])("AC-001.6 answers 502 with the save-failed message on %s", async (_n, arrange) => {
    arrange();
    const res = await post({ title: "X" });
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ message: "The task could not be saved. Please try again." });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
