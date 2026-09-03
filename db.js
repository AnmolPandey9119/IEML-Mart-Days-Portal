require("dotenv").config();
const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  console.warn(
    "[warn] DATABASE_URL is not set. On Render, add it under Environment " +
      "as the SAME Neon connection string used by the ieml-martdays-registration site."
  );
}

// Neon requires SSL. rejectUnauthorized:false keeps this working across
// the various Neon pooled/unpooled connection string formats.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

module.exports = pool;
