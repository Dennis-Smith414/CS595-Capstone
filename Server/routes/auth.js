// Server/routes/auth.js
require('dotenv').config({ path: '../.env' });
console.log('[boot] DATABASE_URL =', process.env.DATABASE_URL);

const express = require("express");
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");

const router = express.Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const isNonEmpty = (s) => typeof s === "string" && s.trim().length > 0;
const strongPwd = (s) =>
  typeof s === "string" && s.length >= 8 && /[A-Z]/.test(s) && /[^A-Za-z0-9]/.test(s);
const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

// Ensure users table exists
(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id             BIGSERIAL PRIMARY KEY,
      username       TEXT NOT NULL,
      email          TEXT NOT NULL,
      password_hash  TEXT NOT NULL,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS users_username_ci_uq ON users (LOWER(username));
    CREATE UNIQUE INDEX IF NOT EXISTS users_email_ci_uq    ON users (LOWER(email));

    CREATE OR REPLACE FUNCTION users_touch_updated_at()
    RETURNS TRIGGER LANGUAGE plpgsql AS $$
    BEGIN NEW.updated_at := NOW(); RETURN NEW; END $$;

    DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
    CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION users_touch_updated_at();
  `);
})().catch((e) => console.error("users table init failed:", e));

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    let { username, email, password } = req.body || {};
    username = (username || "").trim();
    email = (email || "").trim();

    if (!isNonEmpty(username) || !isNonEmpty(email) || !isNonEmpty(password)) {
      return res.status(400).json({ ok: false, error: "All fields are required." });
    }
    if (!isEmail(email)) {
      return res.status(400).json({ ok: false, error: "Invalid email format." });
    }
    if (!strongPwd(password)) {
      return res.status(400).json({
        ok: false,
        error: "Password must be ≥ 8 chars with 1 uppercase and 1 symbol.",
      });
    }

    const existing = await pool.query(
      `SELECT id FROM users WHERE LOWER(username)=LOWER($1) OR LOWER(email)=LOWER($2)`,
      [username, email]
    );
    if (existing.rowCount) {
      return res.status(409).json({ ok: false, error: "Username or email already in use." });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const ins = await pool.query(
      `INSERT INTO users (username, email, password_hash)
       VALUES ($1,$2,$3)
       RETURNING id, username, email, created_at`,
      [username, email, password_hash]
    );

    res.status(201).json({ ok: true, user: ins.rows[0] });
  } catch (e) {
    console.error("POST /api/auth/register error:", e);
    res.status(500).json({ ok: false, error: "Server error." });
  }
});

module.exports = router;
