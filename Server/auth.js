require('dotenv').config({ path: '../.env' });
console.log('[boot] DATABASE_URL =', process.env.DATABASE_URL);

require("dotenv").config(); // reads Server/.env
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");


//const jwt = require("jsonwebtoken"); <------ Duplicate define

const router = express.Router();

// --- Config ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // If you're using a local PG without SSL, comment the next two lines.
  ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : false,
});

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

// --- Helpers ---
async function ensureUsersTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}
ensureUsersTable().catch((e) => {
  console.error("[auth] ensureUsersTable failed:", e);
});

function isEmail(s = "") {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function pickUserSafe(u) {
  if (!u) return null;
  return { id: u.id, username: u.username, email: u.email, created_at: u.created_at };
}

function signToken(user) {
  return jwt.sign({ uid: user.id, username: user.username }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

// Middleware to extract Bearer token and verify
async function authRequired(req, res, next) {
  try {
    const auth = req.headers.authorization || "";
    const [, token] = auth.split(" ");
    if (!token) return res.status(401).json({ ok: false, error: "Missing token" });

    const payload = jwt.verify(token, JWT_SECRET);
    // Attach minimal identity to request
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ ok: false, error: "Invalid token" });
  }
}

// --- Routes ---

/**
 * POST /api/auth/register
 * body: { username, email, password }
 */
router.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body || {};

    if (!username || !email || !password) {
      return res.status(400).json({ ok: false, error: "username, email, password required" });
    }
    if (!isEmail(email)) {
      return res.status(400).json({ ok: false, error: "Invalid email" });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ ok: false, error: "Password must be at least 8 characters" });
    }

    const pwHash = await bcrypt.hash(String(password), 12);

    // Insert user
    const q = await pool.query(
      `INSERT INTO users (username, email, password_hash)
       VALUES ($1, $2, $3)
       ON CONFLICT (username) DO NOTHING
       RETURNING id, username, email, created_at`,
      [String(username).trim(), String(email).toLowerCase(), pwHash]
    );

    if (!q.rowCount) {
      // Could be username conflict; try email to give nicer error
      const dupe = await pool.query(
        `SELECT 1 FROM users WHERE username = $1 OR email = $2 LIMIT 1`,
        [String(username).trim(), String(email).toLowerCase()]
      );
      const conflict = dupe.rowCount ? "username or email already exists" : "Could not create user";
      return res.status(409).json({ ok: false, error: conflict });
    }

    const user = q.rows[0];
    const token = signToken(user);
    return res.json({ ok: true, user: pickUserSafe(user), token });
  } catch (e) {
    console.error("POST /api/auth/register error:", e);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    let { username, password } = req.body || {};
    username = (username || "").trim();

    if (!isNonEmpty(username) || !isNonEmpty(password)) {
      return res.status(400).json({ ok: false, error: "Username and password are required." });
    }

    // Find the user by their username
    const result = await pool.query(
      `SELECT id, username, password_hash FROM users WHERE LOWER(username) = LOWER($1)`,
      [username]
    );

    if (result.rowCount === 0) {
      return res.status(400).json({ ok: false, error: "Invalid username or password." });
    }

    const user = result.rows[0];

    // Check if the provided password matches the stored hash
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(400).json({ ok: false, error: "Invalid username or password." });
    }

    // If login is successful, create a JWT
    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: "1d" } // Token expires in 1 day
    );

    res.json({ ok: true, token });

  } catch (e) {
    console.error("POST /api/auth/login error:", e);
    res.status(500).json({ ok: false, error: "Server error." });
  }
});

module.exports = router;
