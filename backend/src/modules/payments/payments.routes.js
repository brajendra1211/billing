const router = require("express").Router();
const ctrl = require("./payments.controller");
const { allowRoles } = require("../../middlewares/auth");

router.get(
  "/invoices/:id/payments",
  allowRoles("ADMIN", "STAFF", "VIEWER"),
  ctrl.listByInvoice
);

router.post(
  "/invoices/:id/payments",
  allowRoles("ADMIN", "STAFF"),
  ctrl.addToInvoice
);

router.get(
  "/invoices/:id/payments/:pid/receipt.pdf",
  allowRoles("ADMIN", "STAFF", "VIEWER"),
  ctrl.receiptPdf
);

module.exports = router;
