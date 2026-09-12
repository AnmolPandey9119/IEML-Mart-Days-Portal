require("dotenv").config();
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const compression = require("compression");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const pool = require("./db");

const app = express();
app.use(compression()); // gzip/br every response — HTML/CSS/JS/JSON compress ~70-80%
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
// Confirmed live schema (given by the team): the buyer registrations
// table is `mart_days_registrations`. It has NO separate `id` column —
// `urn` (TEXT) is itself the primary key, and the timestamp column is
// `registered_at`, not `created_at`. The registration form and its badge
// print/scan kiosk also now write: nature_of_business, annual_turnover,
// known_through, online_seller, products_of_interest, print_count,
// scan_count, last_scanned_at, badge_download_count.
// ---------------------------------------------------------------------
const buyers_TABLE = process.env.buyers_TABLE || "mart_days_registrations";
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
  // Also added by migrations/schema.sql — lead source ("Website" by
  // default; "Meta" for anything brought in via Bulk Upload).
  source: "source",
  // Business/interest details collected by the registration form.
  natureOfBusiness: "nature_of_business",
  annualTurnover: "annual_turnover",
  knownThrough: "known_through",
  onlineSeller: "online_seller",
  productsOfInterest: "products_of_interest",
  // Badge print/scan tracking — written by the registration site's
  // badge kiosk/scanner, read-only from this portal's point of view.
  printCount: "print_count",
  scanCount: "scan_count",
  lastScannedAt: "last_scanned_at",
  badgeDownloadCount: "badge_download_count",
};
const STATUS_VALUES = ["Registered", "Approved", "Rejected"];
// Fields the "Edit" action is allowed to change. Deliberately excludes
// urn/registered_at/attended/print_count/scan_count/last_scanned_at/
// badge_download_count — those are either identity, handled by their own
// dedicated actions, or owned by the badge kiosk/scanner, not the admin.
const EDITABLE_VISITOR_FIELDS = [
  "buyerType", "fullName", "companyName", "designation",
  "email", "phone", "address", "country", "state", "district", "pincode",
  "natureOfBusiness", "annualTurnover", "knownThrough", "onlineSeller", "productsOfInterest",
  "source",
];
// Dropdown options offered for the "Source" field (filter + edit). Not
// enforced strictly server-side — an existing/unusual value already on a
// row is always preserved and shown as an extra option by the frontend.
const SOURCE_VALUES = ["Website", "Meta", "Other"];
// Columns actually shown/searchable in the buyers table (in this order).
const VISITOR_LIST_COLUMNS = [
  { key: "urn", label: "URN" },
  { key: "fullName", label: "Full Name" },
  { key: "companyName", label: "Company" },
  { key: "designation", label: "Designation" },
  { key: "buyerType", label: "Buyer Type" },
  { key: "source", label: "Source" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "country", label: "Country" },
  { key: "state", label: "State" },
  { key: "district", label: "District" },
  { key: "pincode", label: "Pincode" },
  { key: "natureOfBusiness", label: "Nature of Business" },
  { key: "annualTurnover", label: "Annual Turnover" },
  { key: "knownThrough", label: "Known Through" },
  { key: "onlineSeller", label: "Online Seller" },
  { key: "productsOfInterest", label: "Products of Interest" },
  { key: "createdAt", label: "Registered On" },
];

app.use(express.json());
app.use(cookieParser());

app.get("/", (req, res) => res.redirect("/login.html"));
app.get("/api/branding", (req, res) => res.json(BRANDING));
app.use(express.static(path.join(__dirname, "public"), {
  setHeaders: (res, filePath) => {
    // HTML must always be revalidated (so deploys show up immediately);
    // CSS/JS/images are safe to cache harder since they aren't
    // content-hashed — a short cache still cuts repeat-visit load time
    // a lot without risking someone being stuck on a stale file for long.
    if (filePath.endsWith(".html")) {
      res.setHeader("Cache-Control", "no-cache");
    } else {
      res.setHeader("Cache-Control", "public, max-age=3600");
    }
  },
}));

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
  if (query.source && query.source.trim()) {
    values.push(query.source.trim());
    clauses.push(`${COL.source} = $${values.length}`);
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
    const dataValues = [...values, pageSize, offset];
    const dataResult = await pool.query(
      `SELECT *, COUNT(*) OVER() AS full_count
       FROM ${buyers_TABLE} ${where}
       ORDER BY ${COL.createdAt} DESC
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      dataValues
    );
    const total = dataResult.rows.length ? parseInt(dataResult.rows[0].full_count, 10) : 0;

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
    const headers = [
      ...VISITOR_LIST_COLUMNS.map((c) => c.key),
      "status", "attended", "attendedAt",
      "printCount", "scanCount", "lastScannedAt", "badgeDownloadCount",
    ];
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

// ---------------------------------------------------------------------
// Bulk Upload — imports buyers from an external CSV/Excel file (e.g. a
// Meta / Facebook lead-ads export). The frontend parses the file
// client-side (so any reasonably-named column headers can be matched
// loosely) and posts the already-mapped rows here as JSON. Every row
// inserted this way:
//   - is tagged ${COL.source} = "Meta" (the whole point of this feature)
//   - gets a freshly generated 6-character URN, same format as every
//     other row, since bulk-uploaded leads never came from the
//     registration site and so never had one
// Every row in the file is imported, even if some fields are blank —
// nothing is skipped just because a column was empty. The live
// mart_days_registrations table has NOT NULL constraints on buyer_type,
// full_name, company_name, email, and phone_number specifically, so for
// THOSE columns only, a blank cell is saved as an empty string rather
// than being left out of the row (Postgres allows "", it just doesn't
// allow NULL there) — every other field is simply left unset when blank.
// A row only ever lands in "failed" for a genuine DB-level error.
// ---------------------------------------------------------------------
const BULK_UPLOAD_FIELDS = [
  "buyerType", "fullName", "companyName", "designation", "email", "phone",
  "address", "country", "state", "district", "pincode",
  "natureOfBusiness", "annualTurnover", "knownThrough", "onlineSeller", "productsOfInterest",
];
// These columns are NOT NULL on the live table — always included in the
// INSERT (as "" if blank in the file) so a missing value here never
// causes the whole row to fail or be skipped.
const BULK_NOT_NULL_FIELDS = ["buyerType", "fullName", "companyName", "email", "phone"];
const BULK_UPLOAD_SOURCE = "Meta";
const BULK_MAX_ROWS = 5000;

// Same style as the registration site's own URNs — a 6-character
// uppercase alphanumeric code (e.g. "0KUKWL", "A7AXQ6") — so
// bulk-uploaded buyers look identical to everyone else in the table.
// ~36^6 (≈2.2 billion) possible codes, but collisions are still checked
// for below and retried rather than assumed away.
const URN_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
function generateBulkUrn() {
  let out = "";
  for (let i = 0; i < 6; i++) out += URN_CHARS[crypto.randomInt(URN_CHARS.length)];
  return out;
}

app.post("/api/buyers/bulk", requireAuth, async (req, res) => {
  const rows = Array.isArray(req.body && req.body.rows) ? req.body.rows : [];
  if (rows.length === 0) return res.status(400).json({ error: "No rows to import." });
  if (rows.length > BULK_MAX_ROWS) {
    return res.status(400).json({ error: `Too many rows in one upload (max ${BULK_MAX_ROWS}).` });
  }

  let inserted = 0;
  const failed = [];

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i] || {};
    const cols = [COL.id, COL.source, COL.createdAt];
    const staticValues = [BULK_UPLOAD_SOURCE, new Date()]; // URN is generated per attempt below, prepended each time

    // NOT NULL columns — always included, blank becomes "" rather than
    // being omitted, so the row is never rejected over a missing value.
    for (const field of BULK_NOT_NULL_FIELDS) {
      const val = raw[field];
      cols.push(COL[field]);
      staticValues.push(val !== undefined && val !== null ? String(val).trim() : "");
    }
    // Every other field — nullable on the live table, so only included
    // when the file actually had a value for it.
    for (const field of BULK_UPLOAD_FIELDS) {
      if (BULK_NOT_NULL_FIELDS.includes(field)) continue;
      const val = raw[field];
      if (val === undefined || val === null || String(val).trim() === "") continue;
      cols.push(COL[field]);
      staticValues.push(String(val).trim());
    }

    const placeholders = cols.map((_, idx) => `$${idx + 1}`);
    let rowInserted = false;
    let lastErr = null;
    // Up to 5 tries: a fresh random URN each attempt, in case of a
    // (very unlikely) collision with an existing 6-character code.
    for (let attempt = 0; attempt < 5 && !rowInserted; attempt++) {
      const values = [generateBulkUrn(), ...staticValues];
      try {
        await pool.query(
          `INSERT INTO ${buyers_TABLE} (${cols.join(", ")}) VALUES (${placeholders.join(", ")})`,
          values
        );
        rowInserted = true;
        inserted++;
      } catch (err) {
        lastErr = err;
        if (err.code !== "23505") break; // only worth retrying on a URN collision
      }
    }
    if (!rowInserted) {
      failed.push({ row: i + 2, error: lastErr ? lastErr.message : "Unknown error while inserting row." });
    }
  }

  res.json({ success: true, inserted, failedCount: failed.length, failed: failed.slice(0, 50) });
});

app.get("/api/analytics/buyers", requireAuth, async (req, res) => {
  try {
    const labels = ["total", "buyerType", "country", "trend", "attended", "status", "state", "knownThrough", "source"];
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
      pool.query(
        `SELECT COALESCE(NULLIF(TRIM(${COL.status}), ''), 'Registered') AS label, COUNT(*)::int AS count
         FROM ${buyers_TABLE} GROUP BY 1 ORDER BY count DESC`
      ),
      pool.query(
        `SELECT COALESCE(NULLIF(TRIM(${COL.state}), ''), 'Not specified') AS label, COUNT(*)::int AS count
         FROM ${buyers_TABLE} GROUP BY 1 ORDER BY count DESC LIMIT 10`
      ),
      pool.query(
        `SELECT COALESCE(NULLIF(TRIM(${COL.knownThrough}), ''), 'Not specified') AS label, COUNT(*)::int AS count
         FROM ${buyers_TABLE} GROUP BY 1 ORDER BY count DESC LIMIT 8`
      ),
      pool.query(
        `SELECT COALESCE(NULLIF(TRIM(${COL.source}), ''), 'Website') AS label, COUNT(*)::int AS count
         FROM ${buyers_TABLE} GROUP BY 1 ORDER BY count DESC`
      ),
    ]);
    results.forEach((r, i) => {
      if (r.status === "rejected") console.error(`visitor analytics "${labels[i]}" failed:`, r.reason && r.reason.message);
    });
    const [total, buyerType, country, trend, attended, status, state, knownThrough, source] = results.map((r) =>
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
      byStatus: status.rows,
      byState: state.rows,
      byKnownThrough: knownThrough.rows,
      bySource: source.rows,
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

// Each filter is its OWN field — they combine with AND, same pattern as
// buildVisitorWhere() for buyers (no more single combined search box).
function buildOwnerWhere(query) {
  const clauses = [];
  const values = [];

  const addIlike = (col, val) => {
    if (!val || !val.trim()) return;
    values.push(`%${val.trim()}%`);
    clauses.push(`${col} ILIKE $${values.length}`);
  };

  addIlike("urn", query.urn);
  addIlike("full_name", query.fullName);
  addIlike("company_name", query.companyName);
  addIlike("category", query.category);
  addIlike("mobile_number", query.mobile);
  addIlike("email", query.email);

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return { where, values };
}

app.get("/api/mart-owners", requireAuth, async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 25, 1), 200);
  const offset = (page - 1) * pageSize;
  const { where, values } = buildOwnerWhere(req.query);

  try {
    const dataValues = [...values, pageSize, offset];
    const dataResult = await pool.query(
      `SELECT *, COUNT(*) OVER() AS full_count
       FROM mart_owners ${where}
       ORDER BY created_at DESC
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      dataValues
    );
    const total = dataResult.rows.length ? parseInt(dataResult.rows[0].full_count, 10) : 0;
    const rows = dataResult.rows.map(({ full_count, ...row }) => row);
    res.json({ rows, total, page, pageSize });
  } catch (err) {
    console.error("list mart_owners failed:", err.message);
    res.status(500).json({ error: "Could not load mart owners.", detail: err.message });
  }
});

app.get("/api/mart-owners/export", requireAuth, async (req, res) => {
  const { where, values } = buildOwnerWhere(req.query);
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
// Print history — audit trail of every badge print. Printing itself is
// NOT done from this portal — it happens at the badge kiosk
// (ieml-badgedesk.vercel.app), which writes print_count directly to
// mart_days_registrations. A database trigger (see migrations/schema.sql)
// watches for print_count increasing, regardless of which system caused
// it, and both auto-checks the buyer in and logs the event here — so
// this table stays accurate no matter where a print happens.
// Clearing history only wipes this log table; it never touches
// print_count/attended on the buyer rows themselves.
// ---------------------------------------------------------------------
app.get("/api/print-history", requireAuth, async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 25, 1), 200);
  const offset = (page - 1) * pageSize;
  const day = req.query.day && /^\d{4}-\d{2}-\d{2}$/.test(req.query.day) ? req.query.day : null;
  const where = day ? "WHERE TO_CHAR(l.printed_at, 'YYYY-MM-DD') = $1" : "";
  const values = day ? [day] : [];

  try {
    const dataValues = [...values, pageSize, offset];
    const dataResult = await pool.query(
      `SELECT l.id, l.urn, l.printed_at,
              b.${COL.fullName} AS full_name, b.${COL.companyName} AS company_name,
              COUNT(*) OVER() AS full_count
       FROM badge_print_log l
       LEFT JOIN ${buyers_TABLE} b ON b.${COL.urn} = l.urn
       ${where}
       ORDER BY l.printed_at DESC
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      dataValues
    );
    const total = dataResult.rows.length ? parseInt(dataResult.rows[0].full_count, 10) : 0;
    const rows = dataResult.rows.map(({ full_count, ...row }) => row);
    res.json({ rows, total, page, pageSize });
  } catch (err) {
    console.error("list print-history failed:", err.message);
    res.status(500).json({ error: "Could not load print history.", detail: err.message });
  }
});

app.get("/api/print-history/summary", requireAuth, async (req, res) => {
  try {
    const [totalRes, todayRes, byDayRes] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS count FROM badge_print_log`),
      pool.query(`SELECT COUNT(*)::int AS count FROM badge_print_log WHERE printed_at::date = now()::date`),
      pool.query(
        `SELECT TO_CHAR(printed_at, 'YYYY-MM-DD') AS day, COUNT(*)::int AS count
         FROM badge_print_log GROUP BY 1 ORDER BY 1 DESC LIMIT 30`
      ),
    ]);
    res.json({
      totalPrints: totalRes.rows[0].count,
      todayPrints: todayRes.rows[0].count,
      byDay: byDayRes.rows,
    });
  } catch (err) {
    console.error("print-history summary failed:", err.message);
    res.status(500).json({ error: "Could not load print history summary.", detail: err.message });
  }
});

// DELETE /api/print-history — wipes the audit log only (see note above).
app.delete("/api/print-history", requireAuth, async (req, res) => {
  try {
    await pool.query("DELETE FROM badge_print_log");
    res.json({ success: true });
  } catch (err) {
    console.error("clear print-history failed:", err.message);
    res.status(500).json({ error: "Could not clear print history.", detail: err.message });
  }
});

// ---------------------------------------------------------------------
// DANGER ZONE — permanently deletes every buyer registration (and, via
// ON DELETE CASCADE, their print history). This is deliberately made
// awkward to trigger by accident:
//   1. The frontend requires the admin to type an exact phrase before
//      the button even becomes clickable.
//   2. The frontend then shows a second "are you absolutely sure" popup
//      naming exactly how many rows will be destroyed.
//   3. This endpoint ALSO independently requires the same exact phrase
//      in the request body — so this can't be triggered by a stray
//      button click, a replayed request, or a frontend bug alone.
// There is no "undo" — this is a genuine, permanent delete.
// ---------------------------------------------------------------------
const DANGER_DELETE_ALL_PHRASE = "DELETE ALL DATA";
app.delete("/api/buyers/danger-zone/delete-all", requireAuth, async (req, res) => {
  const phrase = (req.body && req.body.confirmationPhrase) || "";
  if (phrase !== DANGER_DELETE_ALL_PHRASE) {
    return res.status(400).json({
      error: `Confirmation phrase did not match. You must send exactly: "${DANGER_DELETE_ALL_PHRASE}"`,
    });
  }
  try {
    const result = await pool.query(`DELETE FROM ${buyers_TABLE}`);
    res.json({ success: true, deletedCount: result.rowCount });
  } catch (err) {
    console.error("DANGER ZONE delete-all failed:", err.message);
    res.status(500).json({ error: "Could not delete all data.", detail: err.message });
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