const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");              // ✅ add
const { run, all, get } = require("../Postgres"); // ✅ add get

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

const isNonEmpty = (s) => typeof s === "string" && s.trim().length > 0;
const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const strongPwd = (s) =>
  typeof s === "string" && s.length >= 8 && /[A-Z]/.test(s) && /[^A-Za-z0-9]/.test(s);

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

    // Uniqueness (case-insensitive)
    const existing = await all(
      `SELECT id FROM users WHERE LOWER(username)=LOWER($1) OR LOWER(email)=LOWER($2)`,
      [username, email]
    );
    if (existing.length) {
      return res.status(409).json({ ok: false, error: "Username or email already in use." });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const result = await run(
      `INSERT INTO users (username, email, password_hash)
       VALUES ($1,$2,$3)
       RETURNING id, username, email, create_time`,
      [username, email, password_hash]
    );

    const rows = result?.rows ?? [];
    return res.status(201).json({ ok: true, user: rows[0] });
  } catch (e) {
    console.error("POST /api/auth/register error:");
    console.error("  code:", e?.code);
    console.error("  message:", e?.message);
    console.error("  detail:", e?.detail);
    console.error("  stack:", e?.stack);
    if (e?.code === "23505") {
      return res.status(409).json({ ok: false, error: "Username or email already in use." });
    }
    return res.status(500).json({ ok: false, error: "Server error." });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ ok: false, error: "Missing credentials" });
    }

    // 🔧 select password_hash (not password)
    const user = await get(
      `SELECT id, username, password_hash
         FROM users
        WHERE username = $1`,
      [username]
    );
    if (!user) return res.status(401).json({ ok: false, error: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ ok: false, error: "Invalid credentials" });

    const token = jwt.sign(
      { sub: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ ok: true, token, user: { id: user.id, username: user.username } });
  } catch (e) {
    console.error("POST /api/auth/login error:", e);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

module.exports = router;
