const ALLOWED_TABLES = new Set(["customers", "vendors", "vendor_services", "items"]);

/**
 * Throws 400 unless row `id` exists in `table` for this company.
 * `extraWhere` lets callers add conditions, e.g. { vendor_id: 5 }.
 */
async function assertOwned(connOrPool, table, companyId, id, label, extraWhere = {}) {
  if (!ALLOWED_TABLES.has(table)) throw new Error(`assertOwned: table not allowed: ${table}`);

  const where = ["id=?", "company_id=?"];
  const params = [id, companyId];
  for (const [k, v] of Object.entries(extraWhere)) {
    where.push(`${k}=?`);
    params.push(v);
  }

  const [rows] = await connOrPool.query(
    `SELECT id FROM ${table} WHERE ${where.join(" AND ")} LIMIT 1`,
    params
  );
  if (!rows[0]) {
    const err = new Error(`${label} not found: ${id}`);
    err.statusCode = 400;
    throw err;
  }
}

module.exports = { assertOwned };
