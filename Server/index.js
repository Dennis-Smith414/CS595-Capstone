// Server/index.js
require("dotenv").config({ path: __dirname + "/.env", override: true });

// ✅ 1. Add a clear boot-time check for DATABASE_URL
if (!process.env.DATABASE_URL) {
  console.error("[boot] ❌ No DATABASE_URL found. Check your .env file path and contents.");
  process.exit(1);
}

console.log("[boot] ✅ DATABASE_URL =", process.env.DATABASE_URL);

const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");        // ✅ 2. Import here for quick connectivity check

const PORT = process.env.PORT || 5100;
const app = express();

app.use(cors());
app.use(express.json());

// ✅ Optional: early DB connectivity check (helps catch SASL/password errors early)
(async () => {
  try {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const r = await pool.query("SELECT NOW()");
    console.log("[boot] ✅ DB connection OK, time:", r.rows[0].now);
    await pool.end();
  } catch (err) {
    console.error("[boot] ❌ DB connection failed:", err);
    process.exit(1);   // bail out early if DB is misconfigured
  }
})();

// Full GPX/Trails router (list, meta, geojson, bbox, upload)
const authorize = require("./middleware/authorize");
const gpxRoutes = require("./routes/gpx");
const authRoutes = require("./routes/auth");

// mount the PUBLIC routes under /api
app.use("/api/auth", authRoutes);

// mount the PRIVATE routes with middleware/authorize,
// any request to a gpxRoute will now require a valid token
app.use("/api", authorize, gpxRoutes);

// health
app.get("/api/health", (req, res) => {
  res.json({ ok: true, db: true, startedAt: new Date().toISOString() });
});

app.listen(PORT, () => console.log(`🚀 Backend listening on http://localhost:${PORT}`));
