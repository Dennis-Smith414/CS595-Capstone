// Server/index.js
require("dotenv").config({ path: __dirname + "/.env", override: true });

// Guard: require DB URL
if (!process.env.DATABASE_URL) {
  console.error("[boot] ❌ No DATABASE_URL found. Check your .env file path and contents.");
  process.exit(1);
}
console.log("[boot] DATABASE_URL =", process.env.DATABASE_URL);

const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

// Build app
const PORT = process.env.PORT || 5100;
const app = express();

app.use(cors());
app.use(express.json());

// Quick DB ping (non-fatal in test to avoid noisy exits)
(async () => {
  try {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const r = await pool.query("SELECT NOW()");
    console.log("[boot] ✅ DB connection OK, time:", r.rows[0].now);
    await pool.end();
  } catch (err) {
    console.error("[boot] ❌ DB connection failed:", err);
    // In tests, don't kill the process—Supertest needs the app
    if (process.env.NODE_ENV !== "test") process.exit(1);
  }
})();

// Routers (preserves teammates' logic)
const gpxRoutes = require("./routes/gpx");
const authRoutes = require("./routes/auth");
const waypointRoutes = require("./routes/waypoints");
const userRoutes = require("./routes/users");
const ratingRoutes = require("./routes/ratings");
const commentsRoutes = require("./routes/comments");

// Mount routes under /api
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/waypoints", waypointRoutes);
app.use("/api/ratings", ratingRoutes);
app.use("/api", gpxRoutes);
app.use("/api/comments", commentsRoutes);

// Health
app.get("/api/health", (req, res) => {
  res.json({ ok: true, db: true, startedAt: new Date().toISOString() });
});

// Only listen when run directly, not when required by tests
if (require.main === module) {
  app.listen(PORT, () => console.log(`Backend listening on http://localhost:${PORT}`));
}

module.exports = app; // <-- Supertest imports this
