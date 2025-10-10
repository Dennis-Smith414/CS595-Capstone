// Server/routes/auth.js
// Minimal auth router: register, login, and /me (JWT-protected)

require("dotenv").config(); // reads Server/.env
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");

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

/**
 * POST /api/auth/login
 * body: { emailOrUsername, password }
 */
router.post("/login", async (req, res) => {
  try {
    const { emailOrUsername, password } = req.body || {};
    if (!emailOrUsername || !password) {
      return res.status(400).json({ ok: false, error: "emailOrUsername and password required" });
    }

    const q = await pool.query(
      `SELECT id, username, email, password_hash, created_at
         FROM users
        WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1)
        LIMIT 1`,
      [String(emailOrUsername)]
    );

    if (!q.rowCount) {
      return res.status(401).json({ ok: false, error: "Invalid credentials" });
    }

    const user = q.rows[0];
    const ok = await bcrypt.compare(String(password), user.password_hash);
    if (!ok) return res.status(401).json({ ok: false, error: "Invalid credentials" });

    const token = signToken(user);
    return res.json({ ok: true, user: pickUserSafe(user), token });
  } catch (e) {
    console.error("POST /api/auth/login error:", e);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

/**
 * GET /api/auth/me
 *   Authorization: Bearer <token>
 */
router.get("/me", authRequired, async (req, res) => {
  try {
    const { uid } = req.user;
    const q = await pool.query(
      `SELECT id, username, email, created_at FROM users WHERE id = $1 LIMIT 1`,
      [uid]
    );
    if (!q.rowCount) return res.status(404).json({ ok: false, error: "User not found" });
    return res.json({ ok: true, user: q.rows[0] });
  } catch (e) {
    console.error("GET /api/auth/me error:", e);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});
// Login.tsx (only the bits that matter)
// make sure your fetch calls include `credentials: "include"`

async function handleLogin() {
  setLoading(true);
  setError(null);

  try {
    const res = await fetch("http://localhost:5000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",                // << important for cookie
      body: JSON.stringify({
        usernameOrEmail: username,           // or email field
        password,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || "Login failed");
    }

    // get current user from /me to prove cookie works
    const meRes = await fetch("http://localhost:5000/api/auth/me", {
      credentials: "include",
    });
    const me = await meRes.json();

    // (quick-and-dirty) stash the user in localStorage so we can show it on the page
    localStorage.setItem("oc:user", JSON.stringify(me.user));
    // Navigate somewhere (routes page or map), or replace the alert:
    // navigation("/routes") or similar
    alert(`Logged in as ${me.user.username} (${me.user.email})`);
  } catch (err) {
    console.error(err);
    setError(err.message);
  } finally {
    setLoading(false);
  }
}

module.exports = router;
