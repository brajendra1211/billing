const router = require("express").Router();
const ctrl = require("./reports.controller");

// dashboard data
router.get("/dashboard", ctrl.dashboard);

// all customers dropdown
router.get("/customers", ctrl.customers);

// customer drilldown
router.get("/customers/:customerId", ctrl.customer);
router.get("/customers/:customerId/ledger", ctrl.ledger);

// exports
router.get("/dashboard.xlsx", ctrl.exportDashboardXlsx);
router.get("/dashboard.pdf", ctrl.exportDashboardPdf);

module.exports = router;
