// Server/routes/gpx.js
const express = require("express");
const multer = require("multer");
const crypto = require("crypto");
const gpxParse = require("gpx-parse");
const { run, all } = require("../Postgres"); // ✅ use shared pool/helpers

const router = express.Router();

// Multer → in-memory GPX upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

// 🛰️ Health check
router.get("/routes/ping", (_req, res) => res.json({ ok: true, where: "gpx-router" }));

// 📜 Route list
router.get("/routes/list", async (req, res) => {
  try {
    const { offset = 0, limit = 20, q = "" } = req.query;

    // default + clamp
    const limRaw = Number.parseInt(limit, 10);
    const offRaw = Number.parseInt(offset, 10);
    const lim = Math.min((Number.isFinite(limRaw) && limRaw > 0 ? limRaw : 20), 100);
    const off = Math.max(0, Number.isFinite(offRaw) ? offRaw : 0);

    const where = q ? `WHERE name ILIKE $1` : ``;
    const params = q ? [`%${q}%`, lim, off] : [lim, off];

    const sql = `
      SELECT id, slug, name, region, created_at, updated_at
      FROM routes
      ${where}
      ORDER BY updated_at DESC
      LIMIT $${q ? 2 : 1} OFFSET $${q ? 3 : 2}
    `;
    const rows = await all(sql, params);
    res.json({ items: rows, nextOffset: off + rows.length });
  } catch (e) {
    console.error("list failed:", e);
    res.status(500).json({ error: "list-failed" });
  }
});

// 📌 Route metadata (no geometry)
router.get("/routes/:id.meta", async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await all(
      `SELECT id, slug, name, region, created_at, updated_at FROM routes WHERE id = $1`,
      [id]
    );
    if (!rows.length) return res.sendStatus(404);
    res.json(rows[0]);
  } catch (_e) {
    res.status(500).json({ error: "meta-failed" });
  }
});

// 🧭 GeoJSON for *all GPX entries* of a route
router.get("/routes/:id.geojson", async (req, res) => {
  try {
    const { id } = req.params;
    const geoms = await all(
      `SELECT ST_AsGeoJSON(geometry)::json AS geometry
         FROM gpx
        WHERE route_id = $1`,
      [id]
    );
    if (!geoms.length) return res.sendStatus(404);

    const features = geoms.map((row, idx) => ({
      type: "Feature",
      properties: { route_id: id, segment: idx },
      geometry: row.geometry,
    }));

    res.json({ type: "FeatureCollection", features });
  } catch (e) {
    console.error("geojson failed:", e);
    res.status(500).json({ error: "geojson-failed" });
  }
});

// ⬆️ GPX Upload
router.post("/routes/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "no-file" });

    const xml = req.file.buffer.toString("utf8");
    const checksum = crypto.createHash("sha256").update(xml).digest("hex");

    // ---- Pre-scan the raw XML for non-numeric lat/lon (fail fast) ----
    const TRKPT_RE = /<trkpt[^>]*\blat="([^"]+)"[^>]*\blon="([^"]+)"[^>]*>/gi;
    const NUM_RE = /^-?\d+(?:\.\d+)?$/; // strict decimal
    let hasNonNumeric = false;
    for (const m of xml.matchAll(TRKPT_RE)) {
      const latStr = m[1];
      const lonStr = m[2];
      if (!NUM_RE.test(latStr) || !NUM_RE.test(lonStr)) {
        hasNonNumeric = true;
        break;
      }
    }

    // Parse GPX → tracks (still needed to build geometry)
    const gpx = await new Promise((resolve, reject) =>
      gpxParse.parseGpx(xml, (err, data) => (err ? reject(err) : resolve(data)))
    );

    // ---- Build strictly valid coords from GPX ----
    const toNum = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : NaN;
    };

    const valid = [];
    for (const trk of gpx?.tracks ?? []) {
      for (const seg of trk?.segments ?? []) {
        for (const p of seg ?? []) {
          const lon = toNum(p?.lon);
          const lat = toNum(p?.lat);
          if (
            Number.isFinite(lon) && Number.isFinite(lat) &&
            lon >= -180 && lon <= 180 &&
            lat >= -90 && lat <= 90
          ) {
            valid.push([lon, lat]);
          }
        }
      }
    }

    // Deduplicate consecutive duplicate points
    const coords = [];
    for (let i = 0; i < valid.length; i++) {
      const prev = coords[coords.length - 1];
      const cur = valid[i];
      if (!prev || prev[0] !== cur[0] || prev[1] !== cur[1]) coords.push(cur);
    }

    // Fail if not enough points OR if the pre-scan found any non-numeric lat/lon
    if (coords.length < 2 || hasNonNumeric) {
      return res.status(400).json({ error: "no-track-points" });
    }

    const slug = "route-" + checksum.slice(0, 8);
    const name = gpx?.metadata?.name || gpx?.tracks?.[0]?.name || "Uploaded Route";

    // Upsert route
    const routeIns = await run(
      `INSERT INTO routes (slug, name)
       VALUES ($1,$2)
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [slug, name]
    );
    const routeId = routeIns.rows[0].id;

    // Upsert geometry
    const lineWkt = `LINESTRING(${coords.map(([x, y]) => `${x} ${y}`).join(",")})`;
    await run(
      `INSERT INTO gpx (route_id, name, geometry, file)
       VALUES ($1, $2, ST_GeomFromText($3, 4326), $4)
       ON CONFLICT (route_id) DO UPDATE
         SET name = EXCLUDED.name,
             geometry = EXCLUDED.geometry,
             file = EXCLUDED.file`,
      [routeId, name, lineWkt, req.file.buffer]
    );

    res.json({ ok: true, id: routeId, slug, name });
  } catch (err) {
    console.error("upload failed:", err);
    res.status(500).json({ error: "upload-failed" });
  }
});


// ✏️ Update route metadata
router.patch("/routes/:id", async (req, res) => {
  const { id } = req.params;
  const { name, region } = req.body;

  try {
    const result = await run(
      `UPDATE routes
       SET name = COALESCE($1, name),
           region = COALESCE($2, region),
           updated_at = NOW()
       WHERE id = $3
       RETURNING id, slug, name, region, updated_at`,
      [name, region, id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "not-found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("update route failed:", err);
    res.status(500).json({ error: "update-failed" });
  }
});

module.exports = router;
