// Runs every migrations/*.sql file in order. Files must be idempotent (IF NOT EXISTS).
require("dotenv").config({ quiet: true });
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const env = require("../src/config/env");

(async () => {
  const conn = await mysql.createConnection({
    host: env.DB_HOST,
    user: env.DB_USER,
    password: env.DB_PASS,
    database: env.DB_NAME,
    port: env.DB_PORT,
    multipleStatements: true,
  });
  const dir = path.join(__dirname, "..", "migrations");
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
    await conn.query(fs.readFileSync(path.join(dir, f), "utf-8"));
    console.log("applied", f);
  }
  await conn.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
