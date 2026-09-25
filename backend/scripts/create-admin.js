// Creates the first company (if none exists) and an ADMIN user.
// Usage:
//   npm run create-admin -- --email admin@example.com --password "Secret@123" --name "Admin" --company "My Company Pvt Ltd"
require("dotenv").config({ quiet: true });
const bcrypt = require("bcrypt");
const mysql = require("mysql2/promise");
const env = require("../src/config/env");

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

(async () => {
  const email = arg("email");
  const password = arg("password");
  const name = arg("name") || "Admin";
  const companyName = arg("company") || "My Company";

  if (!email || !password) {
    console.log('Usage: npm run create-admin -- --email you@example.com --password "Secret@123" [--name "Admin"] [--company "Company Name"]');
    process.exit(1);
  }
  if (password.length < 6) throw new Error("Password must be at least 6 characters");

  const conn = await mysql.createConnection({
    host: env.DB_HOST,
    user: env.DB_USER,
    password: env.DB_PASS,
    database: env.DB_NAME,
    port: env.DB_PORT,
  });

  const [[existing]] = await conn.query("SELECT id FROM users WHERE email=? LIMIT 1", [email]);
  if (existing) throw new Error(`User already exists: ${email}`);

  let [[company]] = await conn.query("SELECT id, name FROM companies ORDER BY id LIMIT 1");
  if (!company) {
    const [r] = await conn.query("INSERT INTO companies (name) VALUES (?)", [companyName]);
    company = { id: r.insertId, name: companyName };
    console.log(`Company created: #${company.id} ${companyName}`);
  }

  const hash = await bcrypt.hash(password, 10);
  const [u] = await conn.query(
    "INSERT INTO users (company_id, full_name, email, password_hash, role, is_active) VALUES (?,?,?,?, 'ADMIN', 1)",
    [company.id, name, email, hash]
  );
  console.log(`ADMIN user #${u.insertId} created for ${company.name}: ${email}`);
  await conn.end();
})().catch((e) => {
  console.error("create-admin failed:", e.message);
  process.exit(1);
});
