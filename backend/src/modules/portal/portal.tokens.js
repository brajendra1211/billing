const crypto = require("crypto");
const pool = require("../../config/db");

function publicAppUrl() {
  return String(process.env.PUBLIC_APP_URL || "http://localhost:5173").replace(/\/+$/, "");
}

/** Customer-facing links are only worth sending when the app is reachable from outside */
function isPublicUrlConfigured() {
  return Boolean(process.env.PUBLIC_APP_URL);
}

function portalUrl(token) {
  return `${publicAppUrl()}/portal/${token}`;
}

async function getOrCreateToken(companyId, customerId) {
  const [[existing]] = await pool.query(
    "SELECT token FROM customer_portal WHERE customer_id=? AND company_id=? AND is_active=1",
    [customerId, companyId]
  );
  if (existing) return existing.token;

  const [[cust]] = await pool.query("SELECT id FROM customers WHERE id=? AND company_id=?", [customerId, companyId]);
  if (!cust) {
    const err = new Error("Customer not found");
    err.statusCode = 404;
    throw err;
  }

  const token = crypto.randomBytes(24).toString("hex"); // 48 chars
  await pool.query(
    `INSERT INTO customer_portal (customer_id, company_id, token, is_active)
     VALUES (?,?,?,1)
     ON DUPLICATE KEY UPDATE token=VALUES(token), is_active=1, created_at=NOW()`,
    [customerId, companyId, token]
  );
  return token;
}

/** New token; the old link stops working immediately */
async function regenerateToken(companyId, customerId) {
  await pool.query("UPDATE customer_portal SET is_active=0 WHERE customer_id=? AND company_id=?", [customerId, companyId]);
  return getOrCreateToken(companyId, customerId);
}

async function resolveToken(token) {
  if (!/^[a-f0-9]{48}$/.test(String(token || ""))) return null;
  const [[row]] = await pool.query(
    "SELECT customer_id, company_id FROM customer_portal WHERE token=? AND is_active=1",
    [token]
  );
  if (!row) return null;
  await pool.query("UPDATE customer_portal SET last_access_at=NOW() WHERE customer_id=?", [row.customer_id]);
  return { customerId: Number(row.customer_id), companyId: Number(row.company_id) };
}

module.exports = { publicAppUrl, isPublicUrlConfigured, portalUrl, getOrCreateToken, regenerateToken, resolveToken };
