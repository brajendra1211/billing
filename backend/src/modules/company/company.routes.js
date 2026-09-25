const router = require("express").Router();
const ctrl = require("./company.controller");
const { allowRoles } = require("../../middlewares/auth");

const { uploadLogo, uploadSignature } = require("../../middlewares/upload");

router.get("/me", ctrl.getMe);
router.put("/me", allowRoles("ADMIN"), ctrl.updateMe);
router.post(
  "/me/logo",
  allowRoles("ADMIN"),
  uploadLogo.single("file"),
  ctrl.uploadLogo
);

router.post(
  "/me/signature",
  allowRoles("ADMIN"),
  uploadSignature.single("file"),
  ctrl.uploadSignature
);

module.exports = router;
