const router = require("express").Router();
const ctrl = require("./pdf.controller");

router.get("/invoices/:id/pdf", ctrl.invoicePdf);
router.get("/invoices/:id/payments/:paymentId/receipt.pdf", ctrl.receiptPdf);

module.exports = router;
