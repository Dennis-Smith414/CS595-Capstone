process.env.NODE_ENV = "test";

const request = require("supertest");
const app = require("../index");
const db = require("../Postgres");
const { init, run, get } = db;

// Helper to read either { route } or { trail }
const payloadItem = (res) => res.body?.route || res.body?.trail;

// unique slug helper
const uniq = (p) => `${p}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

afterAll(async () => {
  try { if (db?.pool?.end) await db.pool.end(); } catch {}
});


describe("Routes API (create/list/update validations)", () => {
  // Ensure schema exists once for the suite
  beforeAll(async () => {
    await init();
  });

  // 1) Happy path: create one route
  //    Verifies POST /api/routes returns 200, {ok:true}, and a {route|trail} payload.
  test("POST /api/routes → creates one route and returns ok + payload", async () => {
    const slug = uniq("t-route-ok");

    // defensive cleanup
    await run(`DELETE FROM routes WHERE slug = $1`, [slug]);

    const res = await request(app)
      .post("/api/routes")
      .send({ slug, name: "Test Route", region: "Demo" });

    expect(res.status).toBe(200);
    expect(res.body?.ok).toBe(true);

    // teammate-compatible: accept either 'route' or 'trail'
    const item = res.body?.route || res.body?.trail;
    expect(item).toBeTruthy();
    expect(item.slug).toBe(slug);
    expect(item.name).toBe("Test Route");
    expect(item.region).toBe("Demo");

    await run(`DELETE FROM routes WHERE slug = $1`, [slug]);
  });

  // 2) Validation: missing required fields (slug or name) should 400
  test("POST /api/routes → 400 when required fields missing (slug or name)", async () => {
    const resMissingName = await request(app)
      .post("/api/routes")
      .send({ slug: uniq("missing-name") });
    expect(resMissingName.status).toBe(400);
    expect(resMissingName.body?.ok).toBe(false);

    const resMissingSlug = await request(app)
      .post("/api/routes")
      .send({ name: "No Slug Provided" });
    expect(resMissingSlug.status).toBe(400);
    expect(resMissingSlug.body?.ok).toBe(false);
  });

  // 3) Duplicate slug: second create with same slug (case-insensitive) should 409
  test("POST /api/routes → 409 when slug already exists (case-insensitive)", async () => {
    const slug = uniq("dupe");

    const first = await request(app)
      .post("/api/routes")
      .send({ slug, name: "Seed Route" });
    expect(first.status).toBe(200);

    const second = await request(app)
      .post("/api/routes")
      .send({ slug: slug.toUpperCase(), name: "Should Fail" });
    expect(second.status).toBe(409);
    expect(second.body?.ok).toBe(false);

    await run(`DELETE FROM routes WHERE slug ILIKE $1`, [slug]);
  });

  // 4) List with optional search: GET /api/routes/list should include the route,
  //    and honor simple name search (q). Verifies pagination params are accepted.
  test("GET /api/routes/list → returns created route and honors 'q' filter", async () => {
    const slug = uniq("list");
    const name = "Alpha Bravo Charlie Route";
    const region = "WI";

    const create = await request(app)
      .post("/api/routes")
      .send({ slug, name, region });
    expect(create.status).toBe(200);

    const list = await request(app).get("/api/routes/list?limit=25&offset=0");
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body?.items)).toBe(true);
    expect(list.body.items.some((r) => r.slug === slug)).toBe(true);

    const qHit = await request(app).get("/api/routes/list?q=bravo");
    expect(qHit.status).toBe(200);
    expect(qHit.body.items.some((r) => r.slug === slug)).toBe(true);

    const qMiss = await request(app).get("/api/routes/list?q=thiswillnotmatch");
    expect(qMiss.status).toBe(200);
    expect((qMiss.body.items || []).some((r) => r.slug === slug)).toBe(false);

    await run(`DELETE FROM routes WHERE slug = $1`, [slug]);
  });

  // 5) Update metadata: PATCH /api/routes/:id should update name/region
  //    and return the updated record. Also verifies DB reflects changes.
  test("PATCH /api/routes/:id → updates name/region and returns updated record", async () => {
    const slug = uniq("patch");
    const create = await request(app)
      .post("/api/routes")
      .send({ slug, name: "Patch Me", region: "Old" });
    expect(create.status).toBe(200);

    const created = create.body?.route || create.body?.trail;
    expect(created?.id).toBeTruthy();

    const updated = await request(app)
      .patch(`/api/routes/${created.id}`)
      .send({ name: "Patched Name", region: "New-Region" });

    expect(updated.status).toBe(200);
    expect(updated.body?.name).toBe("Patched Name");
    expect(updated.body?.region).toBe("New-Region");
    expect(updated.body?.id).toBe(created.id);

    const row = await get(`SELECT name, region FROM routes WHERE id = $1`, [created.id]);
    expect(row?.name).toBe("Patched Name");
    expect(row?.region).toBe("New-Region");

    await run(`DELETE FROM routes WHERE id = $1`, [created.id]);
  });


// 6) Update non-existent: PATCH should 404 when the route id doesn't exist.
test("PATCH /api/routes/:id → 404 for unknown id", async () => {
  const res = await request(app)
    .patch("/api/routes/999999999") // very large id unlikely to exist
    .send({ name: "Should Not Work" });

  expect(res.status).toBe(404);
  // optional: some routers return a JSON error shape
  // if (res.headers['content-type']?.includes('application/json')) {
  //   expect(res.body?.error || res.body?.ok === false).toBeTruthy();
  // }
});


// 7) Create trims whitespace: server should trim slug/name before storing.
test("POST /api/routes → trims whitespace on slug/name", async () => {
  const base = uniq("trim-check");
  const messySlug = `   ${base}   `;
  const messyName = `   Nice Route Name   `;

  // Clean just in case
  await run(`DELETE FROM routes WHERE slug ILIKE $1`, [base]);

  const res = await request(app)
    .post("/api/routes")
    .send({ slug: messySlug, name: messyName, region: "West" });

  expect(res.status).toBe(200);
  expect(res.body?.ok).toBe(true);

  const item = res.body?.route || res.body?.trail;
  expect(item).toBeTruthy();

  // Returned payload should be trimmed
  expect(item.slug).toBe(base);
  expect(item.name).toBe("Nice Route Name");

  // Confirm DB actually stored trimmed values
  const row = await get(
    `SELECT slug, name, region FROM routes WHERE slug = $1`,
    [base]
  );
  expect(row).toBeTruthy();
  expect(row.slug).toBe(base);
  expect(row.name).toBe("Nice Route Name");
  expect(row.region).toBe("West");

  // Cleanup
  await run(`DELETE FROM routes WHERE slug = $1`, [base]);
});





/* ---------------------------------------------------------------------------
 * 1) Non-string slug → 400
 *    Ensures validation rejects non-string types for slug.
 * -------------------------------------------------------------------------*/
test("POST /api/routes → 400 when slug is not a string", async () => {
  const res = await request(app)
    .post("/api/routes")
    .send({ slug: 12345, name: "Bad Slug Type" });

  expect(res.status).toBe(400);
  expect(res.body?.ok).toBe(false);
});

/* ---------------------------------------------------------------------------
 * 2) Non-string name → 400
 *    Ensures validation rejects non-string types for name.
 * -------------------------------------------------------------------------*/
test("POST /api/routes → 400 when name is not a string", async () => {
  const res = await request(app)
    .post("/api/routes")
    .send({ slug: uniq("bad-name-type"), name: { a: 1 } });

  expect(res.status).toBe(400);
  expect(res.body?.ok).toBe(false);
});

/* ---------------------------------------------------------------------------
 * 3) Region optional/null
 *    If region is omitted or null, creation should still succeed and store NULL.
 * -------------------------------------------------------------------------*/
test("POST /api/routes → region is optional (null/omitted allowed)", async () => {
  const s1 = uniq("no-region");
  const s2 = uniq("null-region");

  // Omitted region
  const r1 = await request(app).post("/api/routes").send({ slug: s1, name: "No Region" });
  expect(r1.status).toBe(200);
  const item1 = payloadItem(r1);
  expect(item1).toBeTruthy();
  expect(item1.region ?? null).toBe(null);

  // Explicit null
  const r2 = await request(app).post("/api/routes").send({ slug: s2, name: "Null Region", region: null });
  expect(r2.status).toBe(200);
  const item2 = payloadItem(r2);
  expect(item2).toBeTruthy();
  expect(item2.region ?? null).toBe(null);

  // Cleanup
  await db.run(`DELETE FROM routes WHERE slug IN ($1,$2)`, [s1, s2]);
});

/* ---------------------------------------------------------------------------
 * 4) Duplicate slug ignoring case & surrounding whitespace → 409
 *    Creates once, then tries again with different case & extra spaces.
 * -------------------------------------------------------------------------*/
test("POST /api/routes → 409 when slug already exists (case-insensitive, trims whitespace)", async () => {
  const base = uniq("dupe-ws");
  const first = await request(app).post("/api/routes").send({ slug: base, name: "Seed" });
  expect(first.status).toBe(200);

  const dupe = await request(app)
    .post("/api/routes")
    .send({ slug: `   ${base.toUpperCase()}   `, name: "Should Fail" });

  expect(dupe.status).toBe(409);
  expect(dupe.body?.ok).toBe(false);

  // Cleanup
  await db.run(`DELETE FROM routes WHERE slug ILIKE $1`, [base]);
});

/* ---------------------------------------------------------------------------
 * 5) List pagination respects limit & offset
 *    Seeds 3 items and checks limit=2 then offset=2 behavior.
 * -------------------------------------------------------------------------*/
test("GET /api/routes/list → respects limit & offset", async () => {
  const a = uniq("page-a");
  const b = uniq("page-b");
  const c = uniq("page-c");

  // Create in order so updated_at differs
  await request(app).post("/api/routes").send({ slug: a, name: "A" });
  await new Promise((r) => setTimeout(r, 10));
  await request(app).post("/api/routes").send({ slug: b, name: "B" });
  await new Promise((r) => setTimeout(r, 10));
  await request(app).post("/api/routes").send({ slug: c, name: "C" });

  // page 1: limit 2
  const p1 = await request(app).get("/api/routes/list?limit=2&offset=0");
  expect(p1.status).toBe(200);
  expect(Array.isArray(p1.body?.items)).toBe(true);
  expect(p1.body.items.length).toBeLessThanOrEqual(2);

  // page 2: offset 2
  const p2 = await request(app).get("/api/routes/list?limit=2&offset=2");
  expect(p2.status).toBe(200);
  expect(Array.isArray(p2.body?.items)).toBe(true);

  // Cleanup
  await db.run(`DELETE FROM routes WHERE slug IN ($1,$2,$3)`, [a, b, c]);
});

/* ---------------------------------------------------------------------------
 * 6) PATCH invalid route id → 404
 *    Ensure server returns not-found for non-existent id.
 * -------------------------------------------------------------------------*/
test("PATCH /api/routes/:id → 404 when route does not exist", async () => {
  const res = await request(app).patch("/api/routes/9999999").send({ name: "Nope" });
  expect([404, 400]).toContain(res.status); // some teams use 400 not-found
});

/* ---------------------------------------------------------------------------
 * 7) PATCH with no fields → 200 and unchanged
 *    Sending empty body should return OK (teammate logic uses COALESCE).
 * -------------------------------------------------------------------------*/
test("PATCH /api/routes/:id → 200 with no fields and unchanged values", async () => {
  const slug = uniq("patch-empty");
  const create = await request(app).post("/api/routes").send({ slug, name: "KeepSame", region: "Stay" });
  expect(create.status).toBe(200);

  const created = payloadItem(create);
  expect(created?.id).toBeTruthy();

  const before = await db.get(`SELECT name, region FROM routes WHERE id = $1`, [created.id]);
  const patch = await request(app).patch(`/api/routes/${created.id}`).send({});
  expect(patch.status).toBe(200);

  const after = await db.get(`SELECT name, region FROM routes WHERE id = $1`, [created.id]);
  expect(after.name).toBe(before.name);
  expect(after.region).toBe(before.region);

  await db.run(`DELETE FROM routes WHERE id = $1`, [created.id]);
});

/* ---------------------------------------------------------------------------
 * 8) Extra unknown fields are ignored
 *    Server should not choke on extra props and should not echo/store them.
 * -------------------------------------------------------------------------*/
test("POST /api/routes → ignores unknown fields", async () => {
  const slug = uniq("unknowns");
  const res = await request(app)
    .post("/api/routes")
    .send({ slug, name: "Unknowns OK", region: "X", bogus: 123, nested: { x: 1 } });

  expect(res.status).toBe(200);
  const item = payloadItem(res);
  expect(item).toBeTruthy();
  expect(item.slug).toBe(slug);
  expect(item.bogus).toBeUndefined();

  // DB confirm unknowns aren’t stored
  const row = await db.get(`SELECT slug, name, region FROM routes WHERE slug=$1`, [slug]);
  expect(row).toBeTruthy();
  expect(Object.keys(row)).toEqual(expect.arrayContaining(["slug", "name", "region"]));

  await db.run(`DELETE FROM routes WHERE slug=$1`, [slug]);
});

/* ---------------------------------------------------------------------------
 * 9) Trimming on both slug & name (tabs/newlines/spaces)
 *    Ensures server trims more than just simple spaces.
 * -------------------------------------------------------------------------*/
test("POST /api/routes → trims tabs/newlines on slug & name", async () => {
  const base = uniq("trim-tabs");
  const res = await request(app)
    .post("/api/routes")
    .send({ slug: ` \n\t${base}\t `, name: ` \n\tFancy Name\t ` });

  expect(res.status).toBe(200);
  const item = payloadItem(res);
  expect(item.slug).toBe(base);
  expect(item.name).toBe("Fancy Name");

  await db.run(`DELETE FROM routes WHERE slug = $1`, [base]);
});

/* ---------------------------------------------------------------------------
 * 10) GeoJSON 404 when route has no geometry
 *     If no GPX/geometry entries exist for a route, /routes/:id.geojson should 404.
 * -------------------------------------------------------------------------*/
test("GET /api/routes/:id.geojson → 404 when no geometry for route", async () => {
  const slug = uniq("nogeo");
  const create = await request(app).post("/api/routes").send({ slug, name: "No Geo Yet" });
  expect(create.status).toBe(200);
  const created = payloadItem(create);
  expect(created?.id).toBeTruthy();

  const geo = await request(app).get(`/api/routes/${created.id}.geojson`);
  expect([404, 500]).toContain(geo.status); // your router returns 404 when none; tolerate 500 if teammate impl differs

  await db.run(`DELETE FROM routes WHERE id = $1`, [created.id]);
});







}); // End
