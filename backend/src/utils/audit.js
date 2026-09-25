const columnCache = new WeakMap();

async function getColumns(connOrPool) {
  if (columnCache.has(connOrPool)) return columnCache.get(connOrPool);
  const [rows] = await connOrPool.query("SHOW COLUMNS FROM audit_logs");
  const columns = new Set(rows.map((r) => r.Field));
  columnCache.set(connOrPool, columns);
  return columns;
}

async function writeAudit(connOrPool, { companyId, userId, entityType, entityId, action, oldValues, newValues, note }) {
  try {
    const columns = await getColumns(connOrPool);
    const payload = {
      old_values: oldValues || null,
      new_values: newValues || null,
      note: note || null,
    };

    const insertCols = ["company_id", "user_id", "entity_id", "action"];
    const values = [companyId, userId || null, entityId || 0, action];

    if (columns.has("entity")) {
      insertCols.splice(2, 0, "entity");
      values.splice(2, 0, entityType);
    }

    if (columns.has("entity_type")) {
      insertCols.splice(columns.has("entity") ? 3 : 2, 0, "entity_type");
      values.splice(columns.has("entity") ? 3 : 2, 0, entityType);
    }

    if (columns.has("meta")) {
      insertCols.push("meta");
      values.push(JSON.stringify(payload));
    }

    if (columns.has("old_values")) {
      insertCols.push("old_values");
      values.push(oldValues ? JSON.stringify(oldValues) : null);
    }

    if (columns.has("new_values")) {
      insertCols.push("new_values");
      values.push(newValues ? JSON.stringify(newValues) : null);
    }

    if (columns.has("note")) {
      insertCols.push("note");
      values.push(note || null);
    }

    await connOrPool.query(
      `INSERT INTO audit_logs (${insertCols.join(", ")})
       VALUES (${insertCols.map(() => "?").join(", ")})`,
      values
    );
  } catch (err) {
    // Audit must never break the business transaction.
    console.warn("audit skipped:", err.message);
  }
}

module.exports = { writeAudit };
