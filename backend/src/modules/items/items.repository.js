const pool = require("../../config/db");

async function findAll(companyId) {
  const [rows] = await pool.query(
    "SELECT * FROM items WHERE company_id=? ORDER BY id DESC",
    [companyId]
  );
  return rows;
}

async function create(companyId, payload) {
  const { type, name, sale_price, tax_percent, hsn_sac, unit } = payload;

  const [result] = await pool.query(
    `INSERT INTO items (company_id, type, name, sale_price, tax_percent, hsn_sac, unit)
     VALUES (?,?,?,?,?,?,?)`,
    [
      companyId,
      type,
      name,
      sale_price ?? 0,
      tax_percent ?? 18,
      hsn_sac || null,
      unit || "Nos",
    ]
  );

  return result.insertId;
}

async function update(companyId, id, payload) {
  const { type, name, sale_price, tax_percent, hsn_sac, unit } = payload;

  const [result] = await pool.query(
    `UPDATE items SET
      type=?,
      name=?,
      sale_price=?,
      tax_percent=?,
      hsn_sac=?,
      unit=?
     WHERE id=? AND company_id=?`,
    [
      type,
      name,
      sale_price ?? 0,
      tax_percent ?? 18,
      hsn_sac || null,
      unit || "Nos",
      id,
      companyId,
    ]
  );

  return result.affectedRows;
}

async function remove(companyId, id) {
  const [result] = await pool.query(
    "DELETE FROM items WHERE id=? AND company_id=?",
    [id, companyId]
  );
  return result.affectedRows;
}

module.exports = { findAll, create, update, remove };
