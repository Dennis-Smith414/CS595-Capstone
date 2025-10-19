// __tests__/api.auth.test.tsx
// Purpose: Verify Android auth flows using the SAME direct fetch pattern your
// LoginScreen and AccountCreationScreen use. We intentionally avoid creating
// a new auth helper so teammates aren’t confused by extra files.

import { API_BASE } from "../src/lib/api";

/**
 * Mirrors LoginScreen’s POST /api/auth/login call.
 * - Sends { username, password } (username trimmed like the screen)
 * - Parses text → JSON (exactly like the screen)
 * - Accepts `token` or `accessToken` for teammate compatibility
 */
async function loginDirect(usernameOrEmail: string, password: string) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: usernameOrEmail.trim(), password }),
  });

  const text = await res.text(); // screen reads text before JSON.parse()
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    // When backend returns HTML/plain text, the screen would also blow up
    throw new Error(`Login: invalid JSON: ${text.slice(0, 200)}`);
  }

  if (!res.ok) {
    // Matches screen behavior: show backend error if present or a fallback
    throw new Error(data?.error || `Invalid credentials. (${res.status})`);
  }

  // Support both shapes to stay compatible with teammates’ API
  const token: string | undefined = data?.token || data?.accessToken;
  if (!token) throw new Error("Missing token in response");
  return { token, user: data?.user };
}

/**
 * Mirrors AccountCreationScreen’s POST /api/auth/register call.
 * - Sends { username, email, password } (username/email trimmed)
 * - Parses text → JSON and returns the backend payload as-is
 */
async function registerDirect(username: string, email: string, password: string) {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: username.trim(), email: email.trim(), password }),
  });

  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Register: invalid JSON: ${text.slice(0, 200)}`);
  }

  if (!res.ok) {
    throw new Error(data?.error || `Failed to create account. (${res.status})`);
  }

  return data; // typically { ok:true, user:{...} }
}

describe("Android Auth (direct fetch calls like screens)", () => {
  let originalFetch: any;

  beforeEach(() => {
    // Keep a reference so we restore after each test
    originalFetch = globalThis.fetch;

    // Default mock is a safe OK response; each test overrides what it needs.
    (globalThis as any).fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        text: async () => JSON.stringify({ ok: true }),
      })
    );
  });

  afterEach(() => {
    (globalThis as any).fetch = originalFetch;
    jest.clearAllMocks();
  });

  /**
   * #1 Login: happy path with `token`
   * Ensures:
   * - The request hits the correct URL with the trimmed username/body
   * - A valid `token` is returned to be saved by AuthContext in the app
   */
  it("loginDirect → succeeds when server returns token", async () => {
    (globalThis as any).fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        text: async () =>
          JSON.stringify({
            token: "t_abc123",
            user: { id: 7, username: "tyler" },
          }),
      })
    );

    const out = await loginDirect("tyler", "Passw0rd!");
    expect(out.token).toBe("t_abc123");
    expect(out.user.username).toBe("tyler");

    const [url, opts] = ((globalThis as any).fetch as jest.Mock).mock.calls[0];
    expect(url).toBe(`${API_BASE}/api/auth/login`);
    expect(JSON.parse(opts.body)).toEqual({ username: "tyler", password: "Passw0rd!" });
  });

  /**
   * #2 Login: alternate success with `accessToken`
   * Some teammates might return `accessToken`. We accept either key.
   */
  it("loginDirect → also accepts accessToken in response", async () => {
    (globalThis as any).fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        text: async () =>
          JSON.stringify({
            accessToken: "alt_token_xyz",
            user: { id: 3, username: "alex" },
          }),
      })
    );

    const out = await loginDirect("alex", "Secret!23");
    expect(out.token).toBe("alt_token_xyz");
  });

  /**
   * #3 Login: error with JSON body
   * If backend sends { error: "..." } on 401, we surface that exact message,
   * matching what your screen does for better UX.
   */
  it("loginDirect → throws clear error on 401 with JSON body", async () => {
    (globalThis as any).fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ error: "Invalid credentials." }),
      })
    );

    await expect(loginDirect("bad", "nope")).rejects.toThrow(/Invalid credentials/);
  });

  /**
   * #4 Login: backend returns non-JSON (HTML, empty text, etc.)
   * The screen’s JSON.parse would fail; test ensures we throw a helpful message.
   */
  it("loginDirect → throws when body isn't JSON", async () => {
    (globalThis as any).fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        text: async () => "NOT_JSON",
      })
    );

    await expect(loginDirect("x", "y")).rejects.toThrow(/invalid JSON/i);
  });

  /**
   * #5 Login: success but no token key present
   * Guards against partial/incorrect backend responses so the app doesn’t
   * silently proceed without a token.
   */
  it("loginDirect → throws if success response lacks token", async () => {
    (globalThis as any).fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        text: async () => JSON.stringify({ ok: true, user: { id: 1 } }),
      })
    );

    await expect(loginDirect("u", "p")).rejects.toThrow(/Missing token/);
  });

  /**
   * #6 Register: happy path
   * Ensures:
   * - We send trimmed username/email
   * - We return the backend payload as-is for the screen to consume
   */
  it("registerDirect → succeeds and returns backend JSON", async () => {
    (globalThis as any).fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        text: async () =>
          JSON.stringify({
            ok: true,
            user: { id: 10, username: "newuser", email: "n@e.com" },
          }),
      })
    );

    const out = await registerDirect("  newuser  ", "  n@e.com  ", "P@ssword1");
    expect(out.ok).toBe(true);
    expect(out.user.username).toBe("newuser"); // trimmed by our call

    const [url, opts] = ((globalThis as any).fetch as jest.Mock).mock.calls[0];
    expect(url).toBe(`${API_BASE}/api/auth/register`);
    expect(JSON.parse(opts.body)).toEqual({
      username: "newuser",
      email: "n@e.com",
      password: "P@ssword1",
    });
  });

  /**
   * #7 Register: backend validation error (400)
   * We surface server-provided error strings to match screen behavior.
   */
  it("registerDirect → surfaces validation error from backend", async () => {
    (globalThis as any).fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ error: "Username already taken" }),
      })
    );

    await expect(registerDirect("taken", "t@e.com", "Password!1")).rejects.toThrow(
      /Username already taken/
    );
  });

  /**
   * #8 Register: invalid JSON body
   * As with login, if text is not parseable JSON, throw a clear error.
   */
  it("registerDirect → throws when backend returns invalid JSON", async () => {
    (globalThis as any).fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        text: async () => "SOMETHING ELSE",
      })
    );

    await expect(registerDirect("u", "e@e.com", "Pw!23456")).rejects.toThrow(/invalid JSON/i);
  });

  /**
   * #9 Login: network failure (fetch rejects)
   * Covers real-world offline errors or abrupt network failures.
   */
  it("loginDirect → rejects when fetch itself rejects", async () => {
    (globalThis as any).fetch = jest.fn(() => Promise.reject(new Error("Network down")));
    await expect(loginDirect("x", "y")).rejects.toThrow("Network down");
  });

  /**
   * #10 Register: synchronous fetch throw
   * Some environments throw synchronously (e.g., immediate configuration error).
   */
  it("registerDirect → throws when fetch synchronously throws", async () => {
    (globalThis as any).fetch = jest.fn(() => {
      throw new Error("Boom");
    });
    await expect(registerDirect("a", "b@c.com", "Pw!23456")).rejects.toThrow("Boom");
  });
});
