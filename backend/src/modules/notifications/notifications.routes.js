const router = require("express").Router();
const ctrl = require("./notifications.controller");
const { allowRoles } = require("../../middlewares/auth");

router.get("/settings", allowRoles("ADMIN", "STAFF"), ctrl.getSettings);
router.put("/settings", allowRoles("ADMIN"), ctrl.saveSettings);
router.post("/run", allowRoles("ADMIN"), ctrl.runNow);
router.post("/test-email", allowRoles("ADMIN"), ctrl.testEmail);
router.get("/log", allowRoles("ADMIN", "STAFF"), ctrl.log);

module.exports = router;
