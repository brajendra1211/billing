const router = require("express").Router();
const ctrl = require("./paymentPlans.controller");
const { allowRoles } = require("../../middlewares/auth");

const ALL = allowRoles("ADMIN", "STAFF", "VIEWER");
const EDIT = allowRoles("ADMIN", "STAFF");

router.get("/", ALL, ctrl.list);
router.post("/", EDIT, ctrl.create);
router.get("/:id", ALL, ctrl.getOne);
router.put("/:id", EDIT, ctrl.update);
router.post("/:id/cancel", allowRoles("ADMIN"), ctrl.cancel);

// milestones
router.get("/milestones/:mid/demand.pdf", ALL, ctrl.demandPdf);
router.post("/milestones/:mid/demand-email", EDIT, ctrl.demandEmail);
router.post("/milestones/:mid/demand-whatsapp", EDIT, ctrl.demandWhatsapp);
router.post("/milestones/:mid/invoice", EDIT, ctrl.createInvoice);

module.exports = router;
