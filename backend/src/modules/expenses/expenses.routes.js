const router = require("express").Router();
const ctrl = require("./expenses.controller");
const { allowRoles } = require("../../middlewares/auth");

// Categories
router.get("/categories", allowRoles("ADMIN", "STAFF", "VIEWER"), ctrl.listCategories);
router.post("/categories", allowRoles("ADMIN", "STAFF"), ctrl.createCategory);
router.put("/categories/:id", allowRoles("ADMIN", "STAFF"), ctrl.updateCategory);

// Expenses
router.get("/", allowRoles("ADMIN", "STAFF", "VIEWER"), ctrl.listExpenses);
router.post("/", allowRoles("ADMIN", "STAFF"), ctrl.createExpense);
router.put("/:id", allowRoles("ADMIN", "STAFF"), ctrl.updateExpense);
router.delete("/:id", allowRoles("ADMIN"), ctrl.deleteExpense);

module.exports = router;
