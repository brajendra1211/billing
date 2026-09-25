// Public customer portal: no login, access is by the secret token in the URL
const router = require("express").Router();
const rateLimit = require("express-rate-limit");
const ctrl = require("./portal.controller");

router.use(rateLimit({ windowMs: 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false }));

router.get("/:token", ctrl.overview);
router.get("/:token/invoices/:id/pdf", ctrl.invoicePdf);
router.post("/:token/invoices/:id/pay", ctrl.pay);
router.post("/:token/invoices/:id/sync", ctrl.sync);

module.exports = router;
