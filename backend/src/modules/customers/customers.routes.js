const router = require("express").Router();
const ctrl = require("./customers.controller");
const portal = require("../portal/portal.controller");
const { allowRoles } = require("../../middlewares/auth");

router.get("/", ctrl.getAll);
router.post("/", ctrl.create);
router.put("/:id", ctrl.update);
router.delete("/:id", ctrl.remove);

// Customer portal link
router.get("/:id/portal-link", portal.staffLink);
router.post("/:id/portal-link/regenerate", allowRoles("ADMIN"), portal.staffRegenerate);

module.exports = router;
