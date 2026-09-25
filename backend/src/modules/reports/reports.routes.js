const router = require("express").Router();
const ctrl = require("./reports.controller");
const { allowRoles } = require("../../middlewares/auth");

// dashboard data
router.get("/dashboard", ctrl.dashboard);

// all customers dropdown
router.get("/customers", ctrl.customers);

// customer drilldown
router.get("/customers/:customerId", ctrl.customer);
router.get("/customers/:customerId/ledger", ctrl.ledger);

// GST & accounting (ADMIN/STAFF)
router.get("/gstr1", allowRoles("ADMIN", "STAFF"), ctrl.gstr1);
router.get("/gstr1.xlsx", allowRoles("ADMIN", "STAFF"), ctrl.gstr1Xlsx);
router.get("/pnl", allowRoles("ADMIN", "STAFF"), ctrl.pnl);
router.get("/pnl.xlsx", allowRoles("ADMIN", "STAFF"), ctrl.pnlXlsx);

// exports
router.get("/dashboard.xlsx", ctrl.exportDashboardXlsx);
router.get("/dashboard.pdf", ctrl.exportDashboardPdf);

module.exports = router;
