// const router = require("express").Router();
// const ctrl = require("./auth.controller");

// router.post("/login", ctrl.login);

// module.exports = router;
const router = require("express").Router();
const ctrl = require("./auth.controller");

router.post("/login", ctrl.login);

module.exports = router;
