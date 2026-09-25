const jwt = require("jsonwebtoken");
const pool = require("../config/db");

async function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ ok: false, error: "Unauthorized" });

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (e) {
    return res.status(401).json({ ok: false, error: "Invalid/Expired token" });
  }

  try {
    // Re-check the user so disabled users / role changes take effect immediately
    const [rows] = await pool.query(
      "SELECT id, role, company_id, is_active FROM users WHERE id=? LIMIT 1",
      [payload.id]
    );
    const user = rows[0];
    if (!user || !user.is_active) {
      return res.status(401).json({ ok: false, error: "User inactive or not found" });
    }
    req.user = { id: user.id, role: user.role, companyId: user.company_id };
    next();
  } catch (e) {
    next(e);
  }
}

function allowRoles(...roles) {
  const allowed = roles.map((r) => String(r).toUpperCase());

  return (req, res, next) => {
    const role = String(req.user?.role || "").toUpperCase();

    if (!role) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    if (!allowed.includes(role)) {
      return res.status(403).json({ ok: false, error: "Forbidden: insufficient permissions" });
    }

    next();
  };
}

module.exports = { authRequired, allowRoles };
