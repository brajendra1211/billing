// Applies migrations/*.sql in filename order, once each (tracked in schema_migrations).
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

  await conn.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       filename VARCHAR(190) NOT NULL PRIMARY KEY,
       applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
  const [done] = await conn.query("SELECT filename FROM schema_migrations");
  const applied = new Set(done.map((r) => r.filename));

  const dir = path.join(__dirname, "..", "migrations");
  const files = fs.readdirSync(dir).filter((x) => x.endsWith(".sql")).sort();
  let count = 0;
  for (const f of files) {
    if (applied.has(f)) continue;
    await conn.query(fs.readFileSync(path.join(dir, f), "utf-8"));
    await conn.query("INSERT INTO schema_migrations (filename) VALUES (?)", [f]);
    console.log("applied", f);
    count++;
  }
  console.log(count ? `${count} migration(s) applied` : "database is up to date");
  await conn.end();
})().catch((e) => {
  console.error("migration failed:", e.message);
  process.exit(1);
});
