require("dotenv").config();
const fs = require("fs");
const path = require("path");
const pool = require("../db");

async function run() {
  const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  console.log("Running migrations/schema.sql against the DB in DATABASE_URL ...");
  try {
    await pool.query(sql);
    console.log("Done. attended / attended_at columns and mart_owners table are ready.");
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();
