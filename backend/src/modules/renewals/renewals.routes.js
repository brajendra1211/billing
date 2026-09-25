const router = require("express").Router();
const ctrl = require("./renewals.controller");
const { allowRoles } = require("../../middlewares/auth");

router.get("/", allowRoles("ADMIN","STAFF","VIEWER"), ctrl.list);
router.post("/", allowRoles("ADMIN","STAFF"), ctrl.create);
router.get("/alerts", allowRoles("ADMIN","STAFF","VIEWER"), ctrl.alerts);

router.get("/:id", allowRoles("ADMIN","STAFF","VIEWER"), ctrl.getOne);
router.put("/:id", allowRoles("ADMIN","STAFF"), ctrl.update);

router.get("/:id/payments", allowRoles("ADMIN","STAFF","VIEWER"), ctrl.paymentsList);
router.post("/:id/payments", allowRoles("ADMIN","STAFF"), ctrl.addPayment);
router.post("/:id/create-invoice", allowRoles("ADMIN","STAFF"), ctrl.createInvoice);

module.exports = router;
