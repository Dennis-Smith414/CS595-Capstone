// __tests__/auth.test.js
process.env.NODE_ENV = "test";

const request = require("supertest");
const app = require("../index");        // index.js must export the Express app
const db = require("../Postgres");      // { init, run, get, pool }
const { init, run, get } = db;

// Helpers
const uniq = (p) => `${p}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const pickToken = (body) => body?.token || body?.accessToken; // teammate-compatible

// Clean shutdown so Jest exits
afterAll(async () => {
  try { if (db?.pool?.end) await db.pool.end(); } catch {}
});

describe("Auth API (register & login)", () => {
  const username = uniq("user");
  const email = `${username}@example.com`;
  const password = "Str0ng!Pass"; // meets strongPwd on backend

  beforeAll(async () => {
    await init();
    // Defensive cleanup in case previous runs left data
    await run(`DELETE FROM users WHERE LOWER(username)=LOWER($1) OR LOWER(email)=LOWER($2)`, [username, email]);
  });

  afterAll(async () => {
    await run(`DELETE FROM users WHERE LOWER(username)=LOWER($1) OR LOWER(email)=LOWER($2)`, [username, email]);
  });

  // 1) Register happy path
  //    Expect 201, ok:true, and a user payload with username/email
  test("POST /api/auth/register → creates a user", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ username, email, password });

    expect([200, 201]).toContain(res.status); // some teams return 200, others 201
    expect(res.body?.ok).toBe(true);
    expect(res.body?.user?.username?.toLowerCase()).toBe(username.toLowerCase());
    expect(res.body?.user?.email?.toLowerCase()).toBe(email.toLowerCase());

    // DB sanity check (password should be hashed -> not equal to plaintext)
    const row = await get(`SELECT username, email, password_hash FROM users WHERE LOWER(username)=LOWER($1)`, [username]);
    expect(row).toBeTruthy();
    expect(row.password_hash).toBeTruthy();
    expect(row.password_hash).not.toBe(password);
  });

  // 2) Duplicate register should 409 (username/email already taken)
  test("POST /api/auth/register → 409 on duplicate username/email", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ username, email, password });

    expect([409, 400]).toContain(res.status); // some teams use 400 for conflict
    // if JSON, ok should be false
    if ((res.headers["content-type"] || "").includes("application/json")) {
      expect(res.body?.ok).toBe(false);
    }
  });

  // 3) Register validation: missing/weak fields → 400
  test("POST /api/auth/register → 400 on missing/invalid fields", async () => {
    const bad1 = await request(app).post("/api/auth/register").send({}); // nothing
    expect(bad1.status).toBe(400);

    const bad2 = await request(app)
      .post("/api/auth/register")
      .send({ username: uniq("u"), email: "not-an-email", password: "Badpass!" });
    expect(bad2.status).toBe(400);

    // Weak password (no uppercase or no symbol) might be rejected by your strongPwd
    const bad3 = await request(app)
      .post("/api/auth/register")
      .send({ username: uniq("u2"), email: `${uniq("e")}@example.com`, password: "weakpass" });
    expect(bad3.status).toBe(400);
  });

  // 4) Login happy path
  //    Your backend’s login currently uses { username, password } and queries by username.
  //    Teammates may send { usernameOrEmail } or { login }. We try the most likely one first (username).
  test("POST /api/auth/login → returns a token for valid credentials", async () => {
    // by username (primary path your backend uses)
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username, password });

    // fallback (if someone changed controller to accept usernameOrEmail)
    const maybeFallback =
      (!res.ok || !pickToken(res.body)) &&
      (await request(app).post("/api/auth/login").send({ usernameOrEmail: username, password }));

    const finalRes = maybeFallback?.status ? maybeFallback : res;

    expect(finalRes.status).toBe(200);
    expect(finalRes.body?.ok ?? true).toBe(true); // some return just token
    const token = pickToken(finalRes.body);
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(10);
  });

  // 5) Login invalid password → 400
  test("POST /api/auth/login → 400 for wrong password", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username, password: "Wrong!Pass1" });

    expect([400, 401]).toContain(res.status);
    if ((res.headers["content-type"] || "").includes("application/json")) {
      expect(res.body?.ok).toBe(false);
    }
  });
});
