const router = require("express").Router();
const ctrl = require("./users.controller");
const { allowRoles } = require("../../middlewares/auth");

// Admin-only user management
router.get("/", allowRoles("ADMIN"), ctrl.list);
router.post("/", allowRoles("ADMIN"), ctrl.create);
router.put("/:id", allowRoles("ADMIN"), ctrl.update);            // edit name/email/role
router.patch("/:id/active", allowRoles("ADMIN"), ctrl.setActive); // enable/disable
router.post("/:id/reset-password", allowRoles("ADMIN"), ctrl.resetPassword);

module.exports = router;
