const pool = require("../../config/db");

/* -------------------- CATEGORIES -------------------- */
async function listCategories(companyId) {
  const [rows] = await pool.query(
    `SELECT id, name, is_active, created_at
     FROM expense_categories
     WHERE company_id=?
     ORDER BY name ASC`,
    [companyId]
  );
  return rows;
}

async function createCategory(companyId, userId, body) {
  const [r] = await pool.query(
    `INSERT INTO expense_categories (company_id, name, is_active, created_at)
     VALUES (?,?,?,NOW())`,
    [companyId, body.name, body.is_active ?? 1]
  );
  return r.insertId;
}

async function updateCategory(companyId, id, body) {
  const fields = [];
  const params = [];
  if (body.name !== undefined) { fields.push("name=?"); params.push(body.name); }
  if (body.is_active !== undefined) { fields.push("is_active=?"); params.push(body.is_active); }
  if (!fields.length) return 0;

  const [r] = await pool.query(
    `UPDATE expense_categories SET ${fields.join(", ")} WHERE company_id=? AND id=?`,
    [...params, companyId, id]
  );
  return r.affectedRows;
}

/* -------------------- EXPENSES -------------------- */
async function listExpenses(companyId, q) {
  const from = (q.from || "").trim();
  const to = (q.to || "").trim();
  const categoryId = Number(q.category_id || 0) || 0;
  const search = (q.search || "").trim();

  const page = Math.max(1, Number(q.page || 1));
  const limit = Math.min(100, Math.max(5, Number(q.limit || 20)));
  const offset = (page - 1) * limit;

  const where = ["e.company_id=?"];
  const params = [companyId];

  if (from) { where.push("e.expense_date >= ?"); params.push(from); }
  if (to) { where.push("e.expense_date <= ?"); params.push(to); }
  if (categoryId) { where.push("e.category_id=?"); params.push(categoryId); }
  if (search) {
    where.push("(e.vendor_name LIKE ? OR e.notes LIKE ? OR e.reference_no LIKE ?)");
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const whereSql = `WHERE ${where.join(" AND ")}`;

  const [cntRows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM expenses e
     ${whereSql}`,
    params
  );
  const total = Number(cntRows[0]?.total || 0);
  const pages = Math.max(1, Math.ceil(total / limit));

  const [rows] = await pool.query(
    `SELECT
        e.id, e.category_id, e.expense_date, e.amount, e.payment_mode,
        e.vendor_name, e.reference_no, e.notes, e.created_at,
        c.name AS category_name
     FROM expenses e
     LEFT JOIN expense_categories c ON c.id=e.category_id
     ${whereSql}
     ORDER BY e.expense_date DESC, e.id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return { rows, page, limit, total, pages };
}

async function createExpense(companyId, userId, body) {
  const [r] = await pool.query(
    `INSERT INTO expenses
     (company_id, category_id, expense_date, amount, payment_mode, vendor_name, reference_no, notes, created_by, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,NOW())`,
    [
      companyId,
      body.category_id,
      body.expense_date,
      body.amount,
      body.payment_mode || "CASH",
      body.vendor_name || null,
      body.reference_no || null,
      body.notes || null,
      userId,
    ]
  );
  return r.insertId;
}

async function getExpense(companyId, id) {
  const [rows] = await pool.query(
    `SELECT * FROM expenses WHERE company_id=? AND id=? LIMIT 1`,
    [companyId, id]
  );
  return rows[0] || null;
}

async function updateExpense(companyId, id, body) {
  const fields = [];
  const params = [];

  const allowed = [
    "category_id",
    "expense_date",
    "amount",
    "payment_mode",
    "vendor_name",
    "reference_no",
    "notes",
  ];

  for (const k of allowed) {
    if (body[k] !== undefined) {
      fields.push(`${k}=?`);
      params.push(body[k]);
    }
  }

  if (!fields.length) return 0;

  const [r] = await pool.query(
    `UPDATE expenses SET ${fields.join(", ")} WHERE company_id=? AND id=?`,
    [...params, companyId, id]
  );
  return r.affectedRows;
}

async function deleteExpense(companyId, id) {
  const [r] = await pool.query(
    `DELETE FROM expenses WHERE company_id=? AND id=?`,
    [companyId, id]
  );
  return r.affectedRows;
}

/* -------------------- SUMMARY (for reports later) -------------------- */
async function sumExpenses(companyId, from, to) {
  const [rows] = await pool.query(
    `SELECT COALESCE(SUM(amount),0) AS total
     FROM expenses
     WHERE company_id=? AND expense_date BETWEEN ? AND ?`,
    [companyId, from, to]
  );
  return Number(rows[0]?.total || 0);
}

module.exports = {
  listCategories,
  createCategory,
  updateCategory,

  listExpenses,
  createExpense,
  getExpense,
  updateExpense,
  deleteExpense,

  sumExpenses,
};
