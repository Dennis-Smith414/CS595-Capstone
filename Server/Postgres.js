// Server/Postgres.js
require('dotenv').config();
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // If using Neon in prod: uncomment SSL line below
  // ssl: { rejectUnauthorized: false },
});

/** Write (INSERT/UPDATE/DELETE). Returns { rowCount, rows }. */
async function run(sql, params = []) {
  const res = await pool.query(sql, params);
  return { rowCount: res.rowCount, rows: res.rows };
}

/** Read many rows. */
async function all(sql, params = []) {
  const res = await pool.query(sql, params);
  return res.rows;
}

/** Read one row (or null). */
async function get(sql, params = []) {
  const res = await pool.query(sql, params);
  return res.rows[0] || null;
}

/** Ensure schema exists. Call this once from index.js before listening. */
async function init() {
  // --- Extensions (idempotent) ---
  await run(`CREATE EXTENSION IF NOT EXISTS postgis`);
  // If you ever use gen_random_uuid(), also enable pgcrypto:
  // await run(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

  // --- Users ---
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(32) NOT NULL,
      email VARCHAR(255),
      password VARCHAR(255) NOT NULL,
      create_time TIMESTAMPTZ DEFAULT now()
    )
  `);

  // --- Routes ---
  await run(`
    CREATE TABLE IF NOT EXISTS routes (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      region TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    )
  `);

  // --- Waypoints ---
  await run(`
    CREATE TABLE IF NOT EXISTS waypoints (
      id SERIAL PRIMARY KEY,
      route_id INT NOT NULL REFERENCES routes(id) ON DELETE CASCADE ON UPDATE CASCADE,
      user_id INT REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
      geom geometry(Point, 4326) NOT NULL,
      ele DOUBLE PRECISION,
      name VARCHAR(63) NOT NULL,
      description TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);

  // --- Comments ---
  await run(`
    CREATE TABLE IF NOT EXISTS comments (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
      waypoint_id INT NOT NULL REFERENCES waypoints(id) ON DELETE CASCADE ON UPDATE CASCADE,
      content TEXT,
      create_time TIMESTAMPTZ DEFAULT now()
    )
  `);

  // --- Ratings (composite PKs) ---
  await run(`
    CREATE TABLE IF NOT EXISTS waypoint_rating (
      user_id INT NOT NULL REFERENCES users(id),
      waypoint_id INT NOT NULL REFERENCES waypoints(id),
      val SMALLINT NOT NULL,
      PRIMARY KEY(user_id, waypoint_id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS route_rating (
      user_id INT NOT NULL REFERENCES users(id),
      route_id INT NOT NULL REFERENCES routes(id),
      val SMALLINT,
      PRIMARY KEY(user_id, route_id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS comment_rating (
      user_id INT NOT NULL REFERENCES users(id),
      comment_id INT NOT NULL REFERENCES comments(id),
      val SMALLINT NOT NULL,
      PRIMARY KEY(user_id, comment_id)
    )
  `);

  // --- GPX (add IF NOT EXISTS to stop the test failures) ---
  await run(`
    CREATE TABLE IF NOT EXISTS gpx (
      id SERIAL PRIMARY KEY,
      route_id INT REFERENCES routes(id) ON DELETE CASCADE,
      name TEXT,
      geometry geometry(LINESTRING, 4326) NOT NULL,
      file BYTEA NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);

  // Optional helpful indexes (idempotent)
  await run(`CREATE INDEX IF NOT EXISTS idx_routes_slug ON routes(slug)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_gpx_route_id ON gpx(route_id)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_waypoints_route ON waypoints(route_id)`);
}

/** Close the pool (call in tests' afterAll) */
async function end() {
  await pool.end();
}

module.exports = { init, run, all, get, end, pool };
