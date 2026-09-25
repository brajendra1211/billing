const router = require("express").Router();
const ctrl = require("./creditNotes.controller");
const { allowRoles } = require("../../middlewares/auth");

router.get("/", allowRoles("ADMIN", "STAFF", "VIEWER"), ctrl.listAll);
router.get("/:id/pdf", allowRoles("ADMIN", "STAFF", "VIEWER"), ctrl.pdf);

module.exports = router;
