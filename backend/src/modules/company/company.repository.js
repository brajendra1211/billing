const pool = require("../../config/db");

async function getById(companyId) {
  const [rows] = await pool.query(
    `SELECT
      id, name, legal_name, gstin, pan,
      billing_address_line1, billing_address_line2,
      billing_city, billing_state, billing_pincode,
      bank_name, bank_account_no, bank_ifsc, upi_id,logo_url, signature_url,
      created_at, updated_at
     FROM companies
     WHERE id=? LIMIT 1`,
    [companyId]
  );
  return rows[0] || null;
}

async function updateById(companyId, patch) {
  // Only update allowed fields
  const fields = [
    "name", "legal_name", "gstin", "pan",
    "billing_address_line1", "billing_address_line2",
    "billing_city", "billing_state", "billing_pincode",
    "bank_name", "bank_account_no", "bank_ifsc",
    "upi_id","logo_url",
"signature_url",
  ];

  const sets = [];
  const values = [];

  for (const f of fields) {
    if (Object.prototype.hasOwnProperty.call(patch, f)) {
      sets.push(`${f}=?`);
      values.push(patch[f]);
    }
  }

  if (sets.length === 0) return 0;

  values.push(companyId);

  const [res] = await pool.query(
    `UPDATE companies SET ${sets.join(", ")}, updated_at=NOW() WHERE id=?`,
    values
  );

  return res.affectedRows;
}

async function setLogoUrl(companyId, logoUrl) {
  const [res] = await pool.query(
    "UPDATE companies SET logo_url=?, updated_at=NOW() WHERE id=?",
    [logoUrl, companyId]
  );
  return res.affectedRows;
}

async function setSignatureUrl(companyId, signatureUrl) {
  const [res] = await pool.query(
    "UPDATE companies SET signature_url=?, updated_at=NOW() WHERE id=?",
    [signatureUrl, companyId]
  );
  return res.affectedRows;
}

module.exports = { getById, updateById, setLogoUrl, setSignatureUrl };
