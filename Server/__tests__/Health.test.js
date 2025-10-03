const request = require('supertest');
const { app, boot } = require('../index');
const { end } = require('../Postgres');

beforeAll(async () => {
  process.env.DATABASE_URL =
    process.env.DATABASE_URL || 'postgres://app:pass@localhost:5432/routes_test';
  await boot(); // runs init(), but does not start app.listen()
});

afterAll(async () => {
  await end(); // closes pg pool
});

test('GET /api/health → 200', async () => {
  const res = await request(app).get('/api/health');
  expect(res.status).toBe(200);
  expect(res.body.ok).toBe(true);
});
