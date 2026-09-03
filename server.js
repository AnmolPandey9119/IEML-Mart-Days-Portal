require("dotenv").config();
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const pool = require("./db");

const app = express();
const PORT = process.env.PORT || 4000;
const IS_PROD = process.env.NODE_ENV === "production";
const COOKIE_NAME = "ieml_mart_token";

app.set("trust proxy", 1); // Render sits behind a proxy — needed so req.ip is real

// ---------------------------------------------------------------------
// BRANDING — only thing you'd change if this portal is ever pointed at
// a different sub-event. Everything else below reads from here.
// ---------------------------------------------------------------------
const BRANDING = {
  eventName: process.env.EVENT_NAME || "IEML Mart Sourcing Days",
  edition: process.env.EVENT_EDITION || "29th Edition · Mega Mart",
  tagline: process.env.EVENT_TAGLINE || "Source Better. Discover More.",
  dateRange: process.env.EVENT_DATE_RANGE || "16–17 Sept 2026",
  venue: process.env.EVENT_VENUE || "India Expo Centre & Mart, Greater Noida, UP",
  registrationUrl: process.env.REGISTRATION_URL || "https://ieml-martdays-registration.vercel.app/",
};

// ---------------------------------------------------------------------
// VISITOR TABLE MAPPING
// ---------------------------------------------------------------------
// This portal reads from the SAME Neon database the public registration
// site (ieml-martdays-registration.vercel.app) already writes to. Set
// buyers_TABLE + the column names below to match that table exactly.
//
// Defaults below are our best guess from the live registration form's
// field names. To CONFIRM (or fix) them without touching any code, sign
// in to this portal once it's deployed and open Settings → "Check DB
// columns" in the sidebar (calls GET /api/schema-check) — it lists the
// real column names straight from Postgres. Then just edit the values
// below to match and redeploy.
//
// Confirmed live schema (given by the team): the `buyers` table has
// NO separate `id` column — `urn` (TEXT) is itself the primary key, and
// the timestamp column is `registered_at`, not `created_at`.
// ---------------------------------------------------------------------
const buyers_TABLE = process.env.buyers_TABLE || "buyers";
const COL = {
  id: "urn", // urn IS the primary key — there is no separate id column
  urn: "urn",
  buyerType: "buyer_type",
  fullName: "full_name",
  companyName: "company_name",
  designation: "designation",
  email: "email",
  phone: "phone_number",
  address: "address",
  country: "country",
  state: "state",
  district: "district",
  pincode: "pincode",
  createdAt: "registered_at",
  // These two are ADDED by migrations/schema.sql — they do not exist on
  // the registration site's original table, so it's safe for this
  // portal to own them.
  attended: "attended",
  attendedAt: "attended_at",
  // Also added by migrations/schema.sql — registration approval workflow.
  status: "status",
};
const STATUS_VALUES = ["Registered", "Approved", "Rejected"];
// Fields the "Edit" action is allowed to change. Deliberately excludes
// urn/registered_at/attended — those are either identity or handled by
// their own dedicated actions.
const EDITABLE_VISITOR_FIELDS = [
  "buyerType", "fullName", "companyName", "designation",
  "email", "phone", "address", "country", "state", "district", "pincode",
];
// Columns actually shown/searchable in the buyers table (in this order).
const VISITOR_LIST_COLUMNS = [
  { key: "urn", label: "URN" },
  { key: "fullName", label: "Full Name" },
  { key: "companyName", label: "Company" },
  { key: "designation", label: "Designation" },
  { key: "buyerType", label: "Buyer Type" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "country", label: "Country" },
  { key: "state", label: "State" },
  { key: "district", label: "District" },
  { key: "pincode", label: "Pincode" },
  { key: "createdAt", label: "Registered On" },
];

app.use(express.json());
app.use(cookieParser());

app.get("/", (req, res) => res.redirect("/login.html"));
app.get("/api/branding", (req, res) => res.json(BRANDING));
app.use(express.static(path.join(__dirname, "public")));

// ---------------------------------------------------------------------
// Auth — same secure pattern as the Bharat Packaging Expo portal:
// httpOnly JWT cookie, timing-safe credential compare, per-IP login
// rate limit, and a hard refusal to run with a guessable secret in prod.
// ---------------------------------------------------------------------
const CONFIGURED_JWT_SECRET = process.env.JWT_SECRET || null;
const JWT_SECRET = CONFIGURED_JWT_SECRET || (IS_PROD ? null : "dev-only-secret-change-me");

if (IS_PROD && !CONFIGURED_JWT_SECRET) {
  console.error("[fatal] JWT_SECRET is not set. Sessions will not work until it's added on Render.");
}

function requireJwtSecret(res) {
  if (JWT_SECRET) return true;
  res.status(500).json({ error: "Server is misconfigured (JWT_SECRET is not set). Contact the admin." });
  return false;
}

function signToken(username) {
  return jwt.sign({ username }, JWT_SECRET, { expiresIn: "12h" });
}

function requireAuth(req, res, next) {
  if (!requireJwtSecret(res)) return;
  const token = req.cookies[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: "Not signed in." });
  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Session expired. Please sign in again." });
  }
}

function safeCompare(a, b) {
  const bufA = Buffer.from(String(a ?? ""));
  const bufB = Buffer.from(String(b ?? ""));
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 5;
const loginAttemptsByIp = new Map();
function isLoginRateLimited(ip) {
  const entry = loginAttemptsByIp.get(ip);
  if (!entry) return false;
  if (Date.now() - entry.windowStart > LOGIN_WINDOW_MS) {
    loginAttemptsByIp.delete(ip);
    return false;
  }
  return entry.count >= LOGIN_MAX_ATTEMPTS;
}
function recordFailedLogin(ip) {
  const now = Date.now();
  const entry = loginAttemptsByIp.get(ip);
  if (!entry || now - entry.windowStart > LOGIN_WINDOW_MS) {
    loginAttemptsByIp.set(ip, { count: 1, windowStart: now });
  } else {
    entry.count += 1;
  }
}
function clearLoginAttempts(ip) {
  loginAttemptsByIp.delete(ip);
}

app.post("/api/login", (req, res) => {
  if (!requireJwtSecret(res)) return;
  const ip = req.ip;
  if (isLoginRateLimited(ip)) {
    res.set("Retry-After", "900");
    return res.status(429).json({ error: "Too many sign-in attempts. Please wait 15 minutes." });
  }
  const { username, password } = req.body || {};
  const validUser = process.env.ADMIN_USERNAME;
  const validPass = process.env.ADMIN_PASSWORD;
  if (!validUser || !validPass) {
    return res.status(500).json({ error: "Admin credentials are not configured on the server." });
  }
  if (!safeCompare(username, validUser) || !safeCompare(password, validPass)) {
    recordFailedLogin(ip);
    return res.status(401).json({ error: "Invalid username or password." });
  }
  clearLoginAttempts(ip);
  const token = signToken(username);
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: IS_PROD,
    maxAge: 12 * 60 * 60 * 1000,
  });
  res.json({ success: true });
});

app.post("/api/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ success: true });
});

app.get("/api/session", (req, res) => {
  const token = req.cookies[COOKIE_NAME];
  if (!token || !JWT_SECRET) return res.json({ authenticated: false });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    res.json({ authenticated: true, username: payload.username });
  } catch {
    res.json({ authenticated: false });
  }
});

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

// Turns a raw DB row (snake_case, per COL) into the logical-key shape
// the frontend uses (fullName, companyName, ...).
function mapVisitorRow(row) {
  const out = {};
  for (const [logicalKey, dbCol] of Object.entries(COL)) {
    out[logicalKey] = row[dbCol];
  }
  return out;
}

// Each filter below is its OWN field — they combine with AND, but each
// one only searches its own column (no more single combined search box).
function buildVisitorWhere(query) {
  const clauses = [];
  const values = [];

  const addIlike = (col, val) => {
    if (!val || !val.trim()) return;
    values.push(`%${val.trim()}%`);
    clauses.push(`${col} ILIKE $${values.length}`);
  };

  addIlike(COL.fullName, query.name);
  addIlike(COL.companyName, query.companyName);
  addIlike(COL.district, query.city);
  addIlike(COL.state, query.state);
  addIlike(COL.country, query.country);

  if (query.emailMobile && query.emailMobile.trim()) {
    values.push(`%${query.emailMobile.trim()}%`);
    const idx = values.length;
    clauses.push(`(${COL.email} ILIKE $${idx} OR ${COL.phone} ILIKE $${idx})`);
  }
  if (query.buyerType && query.buyerType.trim()) {
    values.push(query.buyerType.trim());
    clauses.push(`${COL.buyerType} = $${values.length}`);
  }
  if (query.status && STATUS_VALUES.includes(query.status)) {
    values.push(query.status);
    clauses.push(`${COL.status} = $${values.length}`);
  }
  if (query.attended === "true" || query.attended === "false") {
    values.push(query.attended === "true");
    clauses.push(`${COL.attended} = $${values.length}`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return { where, values };
}

// ---------------------------------------------------------------------
// buyers
// ---------------------------------------------------------------------

app.get("/api/buyers", requireAuth, async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 25, 1), 200);
  const offset = (page - 1) * pageSize;
  const { where, values } = buildVisitorWhere(req.query);

  try {
    const countResult = await pool.query(`SELECT COUNT(*) FROM ${buyers_TABLE} ${where}`, values);
    const total = parseInt(countResult.rows[0].count, 10);

    const dataValues = [...values, pageSize, offset];
    const dataResult = await pool.query(
      `SELECT * FROM ${buyers_TABLE} ${where} ORDER BY ${COL.createdAt} DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      dataValues
    );

    res.json({
      rows: dataResult.rows.map(mapVisitorRow),
      total,
      page,
      pageSize,
      columns: VISITOR_LIST_COLUMNS,
    });
  } catch (err) {
    console.error("list buyers failed:", err.message);
    res.status(500).json({
      error:
        "Could not load buyers. This usually means a column name in server.js doesn't match your Neon table — check GET /api/schema-check.",
      detail: err.message,
    });
  }
});

// PATCH /api/buyers/:id/attended  { attended: true|false }
app.patch("/api/buyers/:id/attended", requireAuth, async (req, res) => {
  const attended = req.body && req.body.attended === true;
  try {
    const result = await pool.query(
      `UPDATE ${buyers_TABLE} SET ${COL.attended} = $1, ${COL.attendedAt} = $2 WHERE ${COL.id} = $3 RETURNING *`,
      [attended, attended ? new Date() : null, req.params.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: "Visitor not found." });
    res.json({ success: true, row: mapVisitorRow(result.rows[0]) });
  } catch (err) {
    console.error("mark attended failed:", err.message);
    res.status(500).json({ error: "Could not update attendance.", detail: err.message });
  }
});

// PATCH /api/buyers/:id/status  { status: 'Registered'|'Approved'|'Rejected' }
// Used by the Approve / Reject action buttons.
app.patch("/api/buyers/:id/status", requireAuth, async (req, res) => {
  const status = req.body && req.body.status;
  if (!STATUS_VALUES.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${STATUS_VALUES.join(", ")}` });
  }
  try {
    const result = await pool.query(
      `UPDATE ${buyers_TABLE} SET ${COL.status} = $1 WHERE ${COL.id} = $2 RETURNING *`,
      [status, req.params.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: "Visitor not found." });
    res.json({ success: true, row: mapVisitorRow(result.rows[0]) });
  } catch (err) {
    console.error("update status failed:", err.message);
    res.status(500).json({ error: "Could not update status.", detail: err.message });
  }
});

// PATCH /api/buyers/:id  — the "Edit" action. Only touches the fields
// listed in EDITABLE_VISITOR_FIELDS; urn/registered_at/attended are never
// changed here.
app.patch("/api/buyers/:id", requireAuth, async (req, res) => {
  const body = req.body || {};
  const setClauses = [];
  const values = [];
  for (const key of EDITABLE_VISITOR_FIELDS) {
    if (body[key] === undefined) continue;
    values.push(body[key] === "" ? null : body[key]);
    setClauses.push(`${COL[key]} = $${values.length}`);
  }
  if (setClauses.length === 0) return res.status(400).json({ error: "No valid fields to update." });
  values.push(req.params.id);
  try {
    const result = await pool.query(
      `UPDATE ${buyers_TABLE} SET ${setClauses.join(", ")} WHERE ${COL.id} = $${values.length} RETURNING *`,
      values
    );
    if (result.rowCount === 0) return res.status(404).json({ error: "Visitor not found." });
    res.json({ success: true, row: mapVisitorRow(result.rows[0]) });
  } catch (err) {
    console.error("edit visitor failed:", err.message);
    res.status(500).json({ error: "Could not save changes.", detail: err.message });
  }
});

// DELETE /api/buyers/:id — the "Delete" action. Permanently removes
// the registration row. Used sparingly — confirmed on the frontend first.
app.delete("/api/buyers/:id", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`DELETE FROM ${buyers_TABLE} WHERE ${COL.id} = $1`, [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Visitor not found." });
    res.json({ success: true });
  } catch (err) {
    console.error("delete visitor failed:", err.message);
    res.status(500).json({ error: "Could not delete visitor.", detail: err.message });
  }
});

app.get("/api/buyers/export", requireAuth, async (req, res) => {
  const { where, values } = buildVisitorWhere(req.query);
  try {
    const result = await pool.query(`SELECT * FROM ${buyers_TABLE} ${where} ORDER BY ${COL.createdAt} DESC`, values);
    const rows = result.rows.map(mapVisitorRow);
    const headers = [...VISITOR_LIST_COLUMNS.map((c) => c.key), "status", "attended"];
    const escape = (val) => {
      if (val === null || val === undefined) return "";
      return `"${String(val).replace(/"/g, '""')}"`;
    };
    const lines = [headers.join(",")];
    for (const row of rows) {
      lines.push(headers.map((h) => escape(row[h])).join(","));
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="mart-buyers.csv"');
    res.send("\uFEFF" + lines.join("\n"));
  } catch (err) {
    console.error("export buyers failed:", err.message);
    res.status(500).json({ error: "Could not export buyers.", detail: err.message });
  }
});

app.get("/api/analytics/buyers", requireAuth, async (req, res) => {
  try {
    const labels = ["total", "buyerType", "country", "trend", "attended"];
    const results = await Promise.allSettled([
      pool.query(`SELECT COUNT(*)::int AS count FROM ${buyers_TABLE}`),
      pool.query(
        `SELECT COALESCE(NULLIF(TRIM(${COL.buyerType}), ''), 'Not specified') AS label, COUNT(*)::int AS count
         FROM ${buyers_TABLE} GROUP BY 1 ORDER BY count DESC`
      ),
      pool.query(
        `SELECT COALESCE(NULLIF(TRIM(${COL.country}), ''), 'Not specified') AS label, COUNT(*)::int AS count
         FROM ${buyers_TABLE} GROUP BY 1 ORDER BY count DESC LIMIT 10`
      ),
      pool.query(
        `SELECT TO_CHAR(${COL.createdAt}, 'YYYY-MM-DD') AS label, COUNT(*)::int AS count
         FROM ${buyers_TABLE} GROUP BY 1 ORDER BY 1`
      ),
      pool.query(`SELECT ${COL.attended} AS attended, COUNT(*)::int AS count FROM ${buyers_TABLE} GROUP BY 1`),
    ]);
    results.forEach((r, i) => {
      if (r.status === "rejected") console.error(`visitor analytics "${labels[i]}" failed:`, r.reason && r.reason.message);
    });
    const [total, buyerType, country, trend, attended] = results.map((r) =>
      r.status === "fulfilled" ? r.value : { rows: [] }
    );

    let attendedCount = 0;
    let notAttendedCount = 0;
    attended.rows.forEach((r) => {
      if (r.attended === true) attendedCount = r.count;
      else notAttendedCount += r.count;
    });

    res.json({
      total: total.rows[0] ? total.rows[0].count : 0,
      attended: attendedCount,
      notAttended: notAttendedCount,
      byBuyerType: buyerType.rows,
      byCountry: country.rows,
      trend: trend.rows,
    });
  } catch (err) {
    console.error("visitor analytics failed:", err.message);
    res.status(500).json({ error: "Could not load analytics.", detail: err.message });
  }
});

// ---------------------------------------------------------------------
// Mart Owners — brand-new, blank list this portal owns. Fill it in
// manually (or via CSV import later) whenever the full list is ready.
// ---------------------------------------------------------------------

function buildOwnerWhere(searchQuery) {
  const search = (searchQuery || "").trim();
  const clauses = [];
  const values = [];
  if (search) {
    values.push(`%${search}%`);
    clauses.push(
      `(urn ILIKE $${values.length} OR full_name ILIKE $${values.length} OR company_name ILIKE $${values.length} OR email ILIKE $${values.length} OR mobile_number ILIKE $${values.length})`
    );
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return { where, values };
}

app.get("/api/mart-owners", requireAuth, async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 25, 1), 200);
  const offset = (page - 1) * pageSize;
  const { where, values } = buildOwnerWhere(req.query.search);

  try {
    const countResult = await pool.query(`SELECT COUNT(*) FROM mart_owners ${where}`, values);
    const total = parseInt(countResult.rows[0].count, 10);
    const dataValues = [...values, pageSize, offset];
    const dataResult = await pool.query(
      `SELECT * FROM mart_owners ${where} ORDER BY created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      dataValues
    );
    res.json({ rows: dataResult.rows, total, page, pageSize });
  } catch (err) {
    console.error("list mart_owners failed:", err.message);
    res.status(500).json({ error: "Could not load mart owners.", detail: err.message });
  }
});

app.get("/api/mart-owners/export", requireAuth, async (req, res) => {
  const { where, values } = buildOwnerWhere(req.query.search);
  try {
    const result = await pool.query(`SELECT * FROM mart_owners ${where} ORDER BY created_at DESC`, values);
    const headers = ["urn", "full_name", "company_name", "category", "mobile_number", "email", "notes", "created_at"];
    const escape = (val) => {
      if (val === null || val === undefined) return "";
      return `"${String(val).replace(/"/g, '""')}"`;
    };
    const lines = [headers.join(",")];
    for (const row of result.rows) {
      lines.push(headers.map((h) => escape(row[h])).join(","));
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="mart-owners.csv"');
    res.send("\uFEFF" + lines.join("\n"));
  } catch (err) {
    console.error("export mart_owners failed:", err.message);
    res.status(500).json({ error: "Could not export mart owners.", detail: err.message });
  }
});

const MART_OWNER_FIELDS = ["urn", "full_name", "company_name", "category", "mobile_number", "email", "notes"];

app.post("/api/mart-owners", requireAuth, async (req, res) => {
  const body = req.body || {};
  if (!body.full_name || !String(body.full_name).trim()) {
    return res.status(400).json({ error: "Full name is required." });
  }
  const cols = MART_OWNER_FIELDS.filter((f) => body[f] !== undefined);
  const values = cols.map((f) => (body[f] === "" ? null : body[f]));
  const placeholders = cols.map((_, i) => `$${i + 1}`);
  try {
    const result = await pool.query(
      `INSERT INTO mart_owners (${cols.join(", ")}) VALUES (${placeholders.join(", ")}) RETURNING *`,
      values
    );
    res.json({ success: true, row: result.rows[0] });
  } catch (err) {
    console.error("create mart_owner failed:", err.message);
    res.status(500).json({ error: "Could not save mart owner.", detail: err.message });
  }
});

app.patch("/api/mart-owners/:id", requireAuth, async (req, res) => {
  const body = req.body || {};
  const setClauses = [];
  const values = [];
  for (const field of MART_OWNER_FIELDS) {
    if (body[field] === undefined) continue;
    values.push(body[field] === "" ? null : body[field]);
    setClauses.push(`${field} = $${values.length}`);
  }
  if (setClauses.length === 0) return res.status(400).json({ error: "No valid fields to update." });
  values.push(req.params.id);
  try {
    const result = await pool.query(
      `UPDATE mart_owners SET ${setClauses.join(", ")} WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (result.rowCount === 0) return res.status(404).json({ error: "Mart owner not found." });
    res.json({ success: true, row: result.rows[0] });
  } catch (err) {
    console.error("update mart_owner failed:", err.message);
    res.status(500).json({ error: "Could not update mart owner.", detail: err.message });
  }
});

app.delete("/api/mart-owners/:id", requireAuth, async (req, res) => {
  try {
    const result = await pool.query("DELETE FROM mart_owners WHERE id = $1", [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Mart owner not found." });
    res.json({ success: true });
  } catch (err) {
    console.error("delete mart_owner failed:", err.message);
    res.status(500).json({ error: "Could not delete mart owner.", detail: err.message });
  }
});

// ---------------------------------------------------------------------
// Schema check — a safe, read-only way to confirm the column-name
// mapping above actually matches your live Neon table, without needing
// to open a DB client. Sign in, then visit /api/schema-check.
// ---------------------------------------------------------------------
app.get("/api/schema-check", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT table_name, column_name, data_type
       FROM information_schema.columns
       WHERE table_name IN ($1, 'mart_owners')
       ORDER BY table_name, ordinal_position`,
      [buyers_TABLE]
    );
    res.json({
      configuredbuyersTable: buyers_TABLE,
      configuredColumnMap: COL,
      liveColumns: result.rows,
    });
  } catch (err) {
    res.status(500).json({ error: "Could not read schema.", detail: err.message });
  }
});

app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, db: "connected" });
  } catch (err) {
    res.status(500).json({ ok: false, db: "not connected", error: err.message });
  }
});

if (require.main === module) {
  if (IS_PROD && !CONFIGURED_JWT_SECRET) {
    console.error("[fatal] Refusing to start: JWT_SECRET is required in production.");
    process.exit(1);
  }
  app.listen(PORT, () => {
    console.log(`IEML Mart Sourcing Days admin portal running at http://localhost:${PORT}`);
  });
}

module.exports = app;