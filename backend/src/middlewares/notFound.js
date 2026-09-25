module.exports = function notFound(req, res, next) {
  res.status(404).json({ ok: false, error: "Route not found" });
};
