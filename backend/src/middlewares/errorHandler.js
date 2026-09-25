const { ZodError } = require("zod");
const multer = require("multer");

module.exports = function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    const first = err.issues?.[0];
    const field = first?.path?.join(".");
    return res.status(400).json({
      ok: false,
      error: field ? `${field}: ${first.message}` : "Invalid input",
      issues: err.issues,
    });
  }

  if (err instanceof multer.MulterError || err.message === "Only PNG/JPG/WEBP allowed") {
    return res.status(400).json({ ok: false, error: err.message });
  }

  const status = err.statusCode || 500;
  if (status >= 500) {
    // Don't leak SQL/internal details to the client
    console.error(err);
    return res.status(status).json({ ok: false, error: "Server error" });
  }

  res.status(status).json({ ok: false, error: err.message });
};
