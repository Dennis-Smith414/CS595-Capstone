// __tests__/Routes.test.js
// ───────────────────────────────────────────────────────────────────────────────
// Global test setup
// ───────────────────────────────────────────────────────────────────────────────

// Give the DB / DDL a little headroom (especially on remote DBs)
jest.setTimeout(20000);

// Tell the server we're in test-mode (so index.js won’t call app.listen)
process.env.NODE_ENV = 'test';

// Ensure the test DB URL is set BEFORE requiring the app or route modules
process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgres://app:pass@localhost:5432/routes_test';

const request = require('supertest');

// Support both export shapes from index.js:
//   - { app, boot }  (preferred)
//   - { app }        (fallback to Postgres.init() below)
const srv = require('../index');
const { init, run, end } = require('../Postgres');
const app = srv.app || srv;
const boot = typeof srv.boot === 'function' ? srv.boot : init;

// ───────────────────────────────────────────────────────────────────────────────
// GPX fixtures (tiny but expressive)
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Minimal valid GPX:
 * WHAT: Two track points → valid LineString.
 * WHY:  Exercises the happy path: upload → persist → list → geojson.
 */
const DEMO_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="demo">
  <trk><name>Demo Track</name><trkseg>
    <trkpt lat="43.038" lon="-87.914"></trkpt>
    <trkpt lat="43.045" lon="-87.920"></trkpt>
  </trkseg></trk>
</gpx>`;

/**
 * WHAT: Only one point in track.
 * WHY:  A LineString requires ≥ 2 points → expect 400 "no-track-points".
 */
const ONE_POINT_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="demo">
  <trk><trkseg>
    <trkpt lat="43.038" lon="-87.914"></trkpt>
  </trkseg></trk>
</gpx>`;

/**
 * WHAT: Malformed XML.
 * WHY:  Parser should throw, endpoint must fail gracefully → 500 "upload-failed".
 */
const MALFORMED_GPX = `<gpx><trk><trkseg><trkpt lat="43.0" lon="-87.0"></trkpt></trkseg></trk>`;

/**
 * WHAT: Non-numeric coordinates for lon/lat.
 * WHY:  They should be filtered; if <2 valid points remain → 400 "no-track-points".
 */
const NAN_COORD_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="demo">
  <trk><trkseg>
    <trkpt lat="NaN" lon="-87.0"></trkpt>
    <trkpt lat="43.0" lon="notanumber"></trkpt>
  </trkseg></trk>
</gpx>`;

/**
 * WHAT: Valid XML but no <trk> at all.
 * WHY:  No usable track geometry → 400 "no-track-points".
 */
const NO_TRACKS_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="demo">
  <metadata><name>Empty</name></metadata>
</gpx>`;

/**
 * WHAT: Only <rte>/<rtept> elements, no tracks.
 * WHY:  Current implementation only consumes <trk>/<trkseg>/<trkpt> → 400.
 */
const RTE_ONLY_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="demo">
  <rte><name>Route Points Only</name>
    <rtept lat="43.0" lon="-87.0"/>
    <rtept lat="43.1" lon="-87.1"/>
  </rte>
</gpx>`;

/**
 * WHAT: Out-of-bounds latitudes ( > 90 ).
 * WHY:  Bounds check should filter these; <2 valid points → 400.
 */
const OOB_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="demo">
  <trk><trkseg>
    <trkpt lat="95.0" lon="0.0"></trkpt>
    <trkpt lat="96.0" lon="0.0"></trkpt>
  </trkseg></trk>
</gpx>`;

/**
 * WHAT: Duplicate points only.
 * WHY:  De-dup collapses to 1 → still invalid LineString → 400.
 */
const DUP_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="demo">
  <trk><trkseg>
    <trkpt lat="43.0" lon="-87.0"></trkpt>
    <trkpt lat="43.0" lon="-87.0"></trkpt>
    <trkpt lat="43.0" lon="-87.0"></trkpt>
  </trkseg></trk>
</gpx>`;

// ───────────────────────────────────────────────────────────────────────────────
// Test lifecycle (boot once, truncate between tests, close pool at end)
// ───────────────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  /**
   * WHAT: Initialize schema / connectivity once for the whole file.
   * WHY:  Avoids re-running DDL for every test; keeps suites fast & stable.
   */
  await boot();
});

beforeEach(async () => {
  /**
   * WHAT: Start each test from a clean slate.
   * WHY:  Determinism—no cross-test data leakage.
   */
  await run('TRUNCATE gpx, routes RESTART IDENTITY CASCADE', []);
});

afterAll(async () => {
  /**
   * WHAT: Close the pg pool.
   * WHY:  Ensures Jest exits cleanly without hanging workers.
   */
  await end();
});

// ───────────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────────

/**
 * WHAT: Helper to POST /api/routes/upload with a GPX payload.
 * WHY:  Deduplicates upload boilerplate across tests.
 */
async function uploadGPX(xml, name = 'file.gpx', contentType = 'application/gpx+xml') {
  return request(app)
    .post('/api/routes/upload')
    .attach('file', Buffer.from(xml, 'utf8'), { filename: name, contentType });
}

// ───────────────────────────────────────────────────────────────────────────────
// Happy path
// ───────────────────────────────────────────────────────────────────────────────

test('POST /api/routes/upload → creates a route from GPX', async () => {
  /**
   * WHAT: Full journey—upload GPX → route persisted → visible in list →
   *       geometry available as GeoJSON.
   * WHY:  This is the primary user flow; if this breaks, the feature is down.
   */
  const res = await uploadGPX(DEMO_GPX, 'demo.gpx');
  expect(res.status).toBe(200);
  expect(res.body.ok).toBe(true);
  expect(typeof res.body.id).toBe('number');
  expect(typeof res.body.slug).toBe('string');
  expect(res.body.slug.length).toBeGreaterThan(0);

  const list = await request(app).get('/api/routes/list');
  expect(list.status).toBe(200);
  expect(Array.isArray(list.body.items)).toBe(true);
  expect(list.body.items.length).toBe(1);
  expect(list.body.items[0].id).toBe(res.body.id);

  const gj = await request(app).get(`/api/routes/${res.body.id}.geojson`);
  expect(gj.status).toBe(200);
  expect(gj.body.type).toBe('FeatureCollection');
  expect(Array.isArray(gj.body.features)).toBe(true);
  expect(gj.body.features.length).toBeGreaterThan(0);
});

// ───────────────────────────────────────────────────────────────────────────────
// Upload validation & error handling
// ───────────────────────────────────────────────────────────────────────────────

test('POST /api/routes/upload → 400 when no file is provided', async () => {
  /**
   * WHAT: Call the endpoint without attaching a file.
   * WHY:  Validate "required file" guard—should return a client error, not 500.
   */
  const res = await request(app).post('/api/routes/upload');
  expect(res.status).toBe(400);
  expect(res.body.error).toBe('no-file');
});

test('POST /api/routes/upload → 400 when GPX has fewer than 2 points', async () => {
  /**
   * WHAT: Upload a GPX with only one track point.
   * WHY:  A line requires ≥ 2 points; enforces basic geometry validity.
   */
  const res = await uploadGPX(ONE_POINT_GPX, 'one.gpx');
  expect(res.status).toBe(400);
  expect(res.body.error).toBe('no-track-points');
});

test('POST /api/routes/upload → 500 when XML is malformed', async () => {
  /**
   * WHAT: Upload syntactically invalid XML.
   * WHY:  Parser should throw; server must catch and respond with 500.
   */
  const res = await uploadGPX(MALFORMED_GPX, 'broken.gpx');
  expect(res.status).toBe(500);
  expect(res.body.error).toBe('upload-failed');
});

test('POST /api/routes/upload → 400 when coords are NaN and <2 valid remain', async () => {
  /**
   * WHAT: Non-numeric lat/lon values in GPX.
   * WHY:  They’re filtered; if fewer than 2 valid points remain, reject with 400.
   */
  const res = await uploadGPX(NAN_COORD_GPX, 'nan.gpx');
  expect(res.status).toBe(400);
  expect(res.body.error).toBe('no-track-points');
});

test('POST /api/routes/upload → 400 when XML has no <trk> segments', async () => {
  /**
   * WHAT: Valid GPX file that doesn’t contain any tracks.
   * WHY:  No usable geometry for a route; reject with 400.
   */
  const res = await uploadGPX(NO_TRACKS_GPX, 'empty.gpx');
  expect(res.status).toBe(400);
  expect(res.body.error).toBe('no-track-points');
});

test('POST /api/routes/upload → 400 when GPX only has <rte>/<rtept> (no tracks)', async () => {
  /**
   * WHAT: The GPX contains only <rte>/<rtept>, not <trk>.
   * WHY:  Current importer consumes tracks only—documented behavior is 400.
   */
  const res = await uploadGPX(RTE_ONLY_GPX, 'rte.gpx');
  expect(res.status).toBe(400);
  expect(res.body.error).toBe('no-track-points');
});

test('POST /api/routes/upload → 400 when out-of-bounds coordinates', async () => {
  /**
   * WHAT: Coordinates outside valid lat/lon ranges.
   * WHY:  Bounds checks should filter them; <2 valid points → reject.
   */
  const res = await uploadGPX(OOB_GPX, 'oob.gpx');
  expect(res.status).toBe(400);
  expect(res.body.error).toBe('no-track-points');
});

test('POST /api/routes/upload → 400 when duplicates collapse to <2 after de-dup', async () => {
  /**
   * WHAT: Three identical points.
   * WHY:  De-dup → single point → not a valid LineString → 400.
   */
  const res = await uploadGPX(DUP_GPX, 'dup.gpx');
  expect(res.status).toBe(400);
  expect(res.body.error).toBe('no-track-points');
});

test('POST /api/routes/upload → rejects file over 10MB (multer limit)', async () => {
  /**
   * WHAT: Attach a file bigger than the 10MB limit.
   * WHY:  Confirms upload guardrails; status depends on Express error handler.
   */
  const big = Buffer.alloc(10 * 1024 * 1024 + 1, 0x41); // 10MB + 1 byte
  const res = await request(app)
    .post('/api/routes/upload')
    .attach('file', big, { filename: 'too-big.gpx', contentType: 'application/gpx+xml' });
  expect([400, 413, 500]).toContain(res.status);
});

test('POST /api/routes/upload → succeeds with text/plain contentType if bytes are valid GPX', async () => {
  /**
   * WHAT: Send valid GPX bytes but with text/plain MIME type.
   * WHY:  Parser reads bytes; MIME shouldn’t block a valid GPX import.
   */
  const res = await uploadGPX(DEMO_GPX, 'demo-as-text.gpx', 'text/plain');
  expect(res.status).toBe(200);
  expect(res.body.ok).toBe(true);
});

// ───────────────────────────────────────────────────────────────────────────────
// Listing behavior & query params
// ───────────────────────────────────────────────────────────────────────────────

test('GET /api/routes/list → empty array when no routes exist', async () => {
  /**
   * WHAT: Fetch list from a clean DB.
   * WHY:  Verify schema/handler shape and "no data" branch.
   */
  const res = await request(app).get('/api/routes/list');
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body.items)).toBe(true);
  expect(res.body.items.length).toBe(0);
});

test('GET /api/routes/list → supports case-insensitive q filter', async () => {
  /**
   * WHAT: Seed 2 routes and filter by lowercased "devils".
   * WHY:  Confirms ILIKE behavior and basic filtering.
   */
  await run(`
    INSERT INTO routes (slug, name, region) VALUES
      ('devils-lake','Devils Lake Route','WI'),
      ('ice-age','Ice Age Trail','WI')
  `);

  const res = await request(app).get('/api/routes/list?q=devils&limit=10');
  expect(res.status).toBe(200);
  expect(res.body.items.length).toBe(1);
  expect(res.body.items[0].slug).toBe('devils-lake');
});

test('GET /api/routes/list → clamps limit to 100 when asked larger', async () => {
  /**
   * WHAT: Request an excessively large page size.
   * WHY:  Ensure the API enforces a maximum and doesn’t overload the DB.
   */
  const rows = Array.from({ length: 120 }, (_, i) => `('s${i}','Route ${i}','WI')`).join(',');
  await run(`INSERT INTO routes (slug, name, region) VALUES ${rows}`);
  const res = await request(app).get('/api/routes/list?limit=1000');
  expect(res.status).toBe(200);
  expect(res.body.items.length).toBeLessThanOrEqual(100);
});

test('GET /api/routes/list → non-integer/negative limit & offset use safe defaults', async () => {
  /**
   * WHAT: Pass "limit=abc&offset=-5".
   * WHY:  Should not 500; fallback to limit=20/offset=0 and return rows.
   */
  const rows = Array.from({ length: 5 }, (_, i) => `('z${i}','Z ${i}','WI')`).join(',');
  await run(`INSERT INTO routes (slug, name, region) VALUES ${rows}`);
  const res = await request(app).get('/api/routes/list?limit=abc&offset=-5');
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body.items)).toBe(true);
  expect(res.body.items.length).toBe(5); // default limit (20) > 5
});

test('GET /api/routes/list → weird SQL-ish q strings do not error', async () => {
  /**
   * WHAT: Use a suspicious query string that would break naive string concat.
   * WHY:  Verifies parameterized query; should not crash or return 500.
   */
  await run(`
    INSERT INTO routes (slug, name, region) VALUES
      ('safe-1','Safe One','WI'),
      ('safe-2','Another Route','WI')
  `);
  const res = await request(app).get(`/api/routes/list?q=' OR 1=1 --&limit=10`);
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body.items)).toBe(true);
});

// ───────────────────────────────────────────────────────────────────────────────
// GeoJSON & meta
// ───────────────────────────────────────────────────────────────────────────────

test('GET /api/routes/:id.geojson → 404 when id does not exist', async () => {
  /**
   * WHAT: Request geometry for a non-existent route ID.
   * WHY:  Correct behavior is a 404 (not 200/empty).
   */
  const res = await request(app).get('/api/routes/99999.geojson');
  expect(res.status).toBe(404);
});

test('GET /api/routes/:id.geojson → 500 when id is invalid (non-integer)', async () => {
  /**
   * WHAT: Pass "not-a-number" as :id.
   * WHY:  DB will reject cast; handler should catch and return 500 "geojson-failed".
   */
  const res = await request(app).get('/api/routes/not-a-number.geojson');
  expect(res.status).toBe(500);
  expect(res.body.error).toBe('geojson-failed');
});

test('GET /api/routes/:id.meta → 404 for missing route', async () => {
  /**
   * WHAT: Request metadata for a missing route ID.
   * WHY:  Should return 404 when route is absent.
   */
  const res = await request(app).get('/api/routes/4242.meta');
  expect(res.status).toBe(404);
});

// ───────────────────────────────────────────────────────────────────────────────
// PATCH behavior
// ───────────────────────────────────────────────────────────────────────────────

test('PATCH /api/routes/:id → 404 for non-existent id', async () => {
  /**
   * WHAT: Update a route that does not exist.
   * WHY:  Should not silently create; respond with 404 "not-found".
   */
  const res = await request(app).patch('/api/routes/99999').send({ name: 'X' });
  expect(res.status).toBe(404);
  expect(res.body.error).toBe('not-found');
});

test('PATCH /api/routes/:id → 500 for invalid id type', async () => {
  /**
   * WHAT: Pass a non-integer ID to PATCH.
   * WHY:  Confirms DB type error is handled and surfaced as 500 "update-failed".
   */
  const res = await request(app).patch('/api/routes/not-an-id').send({ name: 'X' });
  expect(res.status).toBe(500);
  expect(res.body.error).toBe('update-failed');
});

test('PATCH /api/routes/:id → partial/no-op updates keep values, updated_at bumps', async () => {
  /**
   * WHAT: Create a simple route, PATCH with empty and partial bodies.
   * WHY:  COALESCE preserves missing fields; updated_at should change; partials modify only requested fields.
   */
  const inserted = await run(
    `INSERT INTO routes (slug, name, region) VALUES ($1,$2,$3)
     RETURNING id, name, region, updated_at`,
    ['plain', 'Plain', 'WI']
  );
  const id = inserted.rows[0].id;
  const oldUpdatedAt = inserted.rows[0].updated_at;

  // Empty body → keep old values; updated_at advances
  const patch = await request(app).patch(`/api/routes/${id}`).send({});
  expect(patch.status).toBe(200);
  expect(patch.body.id).toBe(id);
  expect(patch.body.name).toBe('Plain');
  expect(patch.body.region).toBe('WI');
  expect(new Date(patch.body.updated_at).getTime())
    .toBeGreaterThan(new Date(oldUpdatedAt).getTime());

  // Only name changes
  const patchName = await request(app).patch(`/api/routes/${id}`).send({ name: 'OnlyName' });
  expect(patchName.status).toBe(200);
  expect(patchName.body.name).toBe('OnlyName');
  expect(patchName.body.region).toBe('WI');

  // Only region changes
  const patchRegion = await request(app).patch(`/api/routes/${id}`).send({ region: 'MN' });
  expect(patchRegion.status).toBe(200);
  expect(patchRegion.body.name).toBe('OnlyName');
  expect(patchRegion.body.region).toBe('MN');
});

// ───────────────────────────────────────────────────────────────────────────────
// Upload idempotency (identical GPX should not duplicate routes)
// ───────────────────────────────────────────────────────────────────────────────

test('POST /api/routes/upload → re-upload of IDENTICAL GPX does not duplicate route', async () => {
  /**
   * WHAT: Upload the exact same GPX twice.
   * WHY:  routes(slug) uses checksum-based slug + ON CONFLICT upsert → keep one route.
   */
  const first = await uploadGPX(DEMO_GPX, 'demo.gpx');
  expect(first.status).toBe(200);

  const second = await uploadGPX(DEMO_GPX, 'demo.gpx');
  expect(second.status).toBe(200);

  const list = await request(app).get('/api/routes/list');
  expect(list.status).toBe(200);
  expect(list.body.items.length).toBe(1);
});
