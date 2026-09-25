const pool = require("../../config/db");

async function findAll(companyId) {
  const [rows] = await pool.query(
    "SELECT * FROM customers WHERE company_id=? ORDER BY id DESC",
    [companyId]
  );
  return rows;
}

async function create(companyId, payload) {
  const {
    name,
    contact_person,
    email,
    phone,
    gstin,
    billing_state,
    billing_city,
    billing_pincode,
    billing_address_line1,
  } = payload;

  const [result] = await pool.query(
    `INSERT INTO customers
     (company_id, name, contact_person, email, phone, gstin,
      billing_state, billing_city, billing_pincode, billing_address_line1)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [
      companyId,
      name,
      contact_person || null,
      email || null,
      phone || null,
      gstin || null,
      billing_state || null,
      billing_city || null,
      billing_pincode || null,
      billing_address_line1 || null,
    ]
  );

  return result.insertId;
}

async function update(companyId, id, payload) {
  const {
    name,
    contact_person,
    email,
    phone,
    gstin,
    billing_state,
    billing_city,
    billing_pincode,
    billing_address_line1,
  } = payload;

  const [result] = await pool.query(
    `UPDATE customers SET
      name=?,
      contact_person=?,
      email=?,
      phone=?,
      gstin=?,
      billing_state=?,
      billing_city=?,
      billing_pincode=?,
      billing_address_line1=?
     WHERE id=? AND company_id=?`,
    [
      name,
      contact_person || null,
      email || null,
      phone || null,
      gstin || null,
      billing_state || null,
      billing_city || null,
      billing_pincode || null,
      billing_address_line1 || null,
      id,
      companyId,
    ]
  );

  return result.affectedRows;
}

async function remove(companyId, id) {
  const [result] = await pool.query(
    "DELETE FROM customers WHERE id=? AND company_id=?",
    [id, companyId]
  );
  return result.affectedRows;
}

module.exports = { findAll, create, update, remove };
