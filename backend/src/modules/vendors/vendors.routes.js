const router = require("express").Router();
const ctrl = require("./vendors.controller");
const { allowRoles } = require("../../middlewares/auth");

// Vendors
router.get("/", allowRoles("ADMIN", "STAFF", "VIEWER"), ctrl.listVendors);
router.post("/", allowRoles("ADMIN", "STAFF"), ctrl.createVendor);
router.put("/:id", allowRoles("ADMIN", "STAFF"), ctrl.updateVendor);

// Services (by vendor)
router.get("/:vendorId/services", allowRoles("ADMIN", "STAFF", "VIEWER"), ctrl.listServices);
router.post("/services", allowRoles("ADMIN", "STAFF"), ctrl.createService);
router.put("/services/:id", allowRoles("ADMIN", "STAFF"), ctrl.updateService);

// Consumption
router.get("/consumption/list", allowRoles("ADMIN", "STAFF", "VIEWER"), ctrl.listConsumption);
router.post("/consumption", allowRoles("ADMIN", "STAFF"), ctrl.createConsumption);
router.put("/consumption/:id", allowRoles("ADMIN", "STAFF"), ctrl.updateConsumption);

// ✅ Bulk save (upsert)
router.post("/consumption/bulk", allowRoles("ADMIN", "STAFF"), ctrl.consumptionBulk);

// Bills
router.get("/bills", allowRoles("ADMIN", "STAFF", "VIEWER"), ctrl.listBills);
router.get("/bills/:id", allowRoles("ADMIN", "STAFF", "VIEWER"), ctrl.getBill);
router.post("/bills/generate", allowRoles("ADMIN", "STAFF"), ctrl.generateBill);
router.post("/bills/:id/pay", allowRoles("ADMIN", "STAFF"), ctrl.addBillPayment);

// ✅ Day template merged (place after fixed routes)
router.get("/:vendorId/consumption/day", allowRoles("ADMIN", "STAFF"), ctrl.consumptionDay);

module.exports = router;
