const pool = require("../../config/db");

async function listUsers(companyId) {
  const [rows] = await pool.query(
    `SELECT id, full_name AS name, email, role, is_active, created_at
     FROM users
     WHERE company_id = ?
     ORDER BY id DESC`,
    [companyId]
  );
  return rows;
}

async function findByEmail(companyId, email) {
  const [rows] = await pool.query(
    `SELECT id FROM users WHERE company_id=? AND email=? LIMIT 1`,
    [companyId, email]
  );
  return rows[0] || null;
}

async function getById(companyId, userId) {
  const [rows] = await pool.query(
    `SELECT id, full_name AS name, email, role, is_active
     FROM users
     WHERE company_id=? AND id=? LIMIT 1`,
    [companyId, userId]
  );
  return rows[0] || null;
}

async function createUser({ companyId, name, email, password_hash, role }) {
  const [r] = await pool.query(
    `INSERT INTO users (company_id, full_name, email, password_hash, role, is_active)
     VALUES (?, ?, ?, ?, ?, 1)`,
    [companyId, name, email, password_hash, role]
  );
  return r.insertId;
}

async function updateUser(companyId, id, { name, email, role }) {
  const fields = [];
  const vals = [];

  if (name !== undefined) { fields.push("full_name=?"); vals.push(name); }
  if (email !== undefined) { fields.push("email=?"); vals.push(email); }
  if (role !== undefined) { fields.push("role=?"); vals.push(role); }

  if (fields.length === 0) return 0;

  vals.push(companyId, id);
  const [r] = await pool.query(
    `UPDATE users SET ${fields.join(", ")} WHERE company_id=? AND id=?`,
    vals
  );
  return r.affectedRows;
}

async function setActive(companyId, id, is_active) {
  const [r] = await pool.query(
    `UPDATE users SET is_active=? WHERE company_id=? AND id=?`,
    [is_active, companyId, id]
  );
  return r.affectedRows;
}

async function resetPassword(companyId, id, password_hash) {
  const [r] = await pool.query(
    `UPDATE users SET password_hash=? WHERE company_id=? AND id=?`,
    [password_hash, companyId, id]
  );
  return r.affectedRows;
}

module.exports = {
  listUsers,
  findByEmail,
  getById,
  createUser,
  updateUser,
  setActive,
  resetPassword,
};
