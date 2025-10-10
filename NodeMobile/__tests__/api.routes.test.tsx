import { fetchRouteList } from "../src/lib/api";

describe("fetchRouteList()", () => {
  let originalFetch: any;

  beforeEach(() => {
    originalFetch = globalThis.fetch;

    (globalThis as any).fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        text: async () =>
          JSON.stringify({
            items: [
              { id: 1, name: "Ice Age Trail – Kettle Moraine", region: "WI" },
              { id: 2, name: "Devil's Lake Loop", region: "WI" },
            ],
          }),
      })
    );
  });

  afterEach(() => {
    (globalThis as any).fetch = originalFetch;
    jest.clearAllMocks();
  });

  it("calls /api/routes/list and returns items", async () => {
    const items = await fetchRouteList();
    expect((globalThis as any).fetch).toHaveBeenCalledTimes(1);

    const urlArg = ((globalThis as any).fetch as jest.Mock).mock.calls[0][0] as string;
    expect(urlArg).toMatch(/\/api\/routes\/list/);

    expect(items).toHaveLength(2);
    expect(items[0].name).toBe("Ice Age Trail – Kettle Moraine");
  });

  it("throws an error when the server responds with a non-OK status", async () => {
  (globalThis as any).fetch = jest.fn(() =>
    Promise.resolve({
      ok: false,
      status: 500,
      text: async () => "Server error",
    })
  );

  await expect(fetchRouteList()).rejects.toThrow();
});

it("throws an error when fetch itself fails (network error)", async () => {
  (globalThis as any).fetch = jest.fn(() => {
    throw new Error("Network failure");
  });

  await expect(fetchRouteList()).rejects.toThrow("Network failure");
});

it("returns an empty array when API responds with no items", async () => {
  (globalThis as any).fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      text: async () => JSON.stringify({ items: [] }),
    })
  );

  const items = await fetchRouteList();
  expect(Array.isArray(items)).toBe(true);
  expect(items).toHaveLength(0);
});

it("throws a clear error when the API returns invalid JSON", async () => {
  (globalThis as any).fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      text: async () => "NOT_VALID_JSON",
    })
  );

  await expect(fetchRouteList()).rejects.toThrow(/Bad JSON from \/routes\/list/i);
});

it("throws a network error when fetch itself rejects", async () => {
  (globalThis as any).fetch = jest.fn(() => Promise.reject(new Error("Network down")));

  await expect(fetchRouteList()).rejects.toThrow("Network down");
  expect((globalThis as any).fetch).toHaveBeenCalledTimes(1);
});


});
