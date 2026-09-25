// Fresh install: creates the database (if missing), loads database/schema.sql into it
// when it has no tables yet, then applies any newer migrations.
// Usage: npm run db:init
require("dotenv").config({ quiet: true });
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const mysql = require("mysql2/promise");
const env = require("../src/config/env");

(async () => {
  if (!/^[A-Za-z0-9_]+$/.test(env.DB_NAME)) throw new Error(`Invalid DB_NAME: ${env.DB_NAME}`);

  const conn = await mysql.createConnection({
    host: env.DB_HOST,
    user: env.DB_USER,
    password: env.DB_PASS,
    port: env.DB_PORT,
    multipleStatements: true,
  });

  await conn.query(
    `CREATE DATABASE IF NOT EXISTS \`${env.DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await conn.query(`USE \`${env.DB_NAME}\``);

  const [tables] = await conn.query("SHOW TABLES");
  if (tables.length === 0) {
    const sql = fs.readFileSync(path.join(__dirname, "..", "database", "schema.sql"), "utf-8");
    await conn.query(sql);
    console.log(`schema.sql loaded into ${env.DB_NAME}`);
  } else {
    console.log(`${env.DB_NAME} already has ${tables.length} tables, skipping schema.sql`);
  }
  await conn.end();

  // Apply migrations newer than the schema snapshot
  execFileSync(process.execPath, [path.join(__dirname, "migrate.js")], { stdio: "inherit" });
})().catch((e) => {
  console.error("db:init failed:", e.message);
  process.exit(1);
});
