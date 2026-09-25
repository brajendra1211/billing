const router = require("express").Router();
const ctrl = require("./invoices.controller");
const { allowRoles } = require("../../middlewares/auth");
const notifications = require("../notifications/notifications.controller");
const creditNotes = require("../creditNotes/creditNotes.controller");
const onlinePayments = require("../onlinePayments/onlinePayments.controller");

// Everyone (including VIEWER)
router.get("/", allowRoles("ADMIN", "STAFF", "VIEWER"), ctrl.list);
router.get("/:id", allowRoles("ADMIN", "STAFF", "VIEWER"), ctrl.getOne);

// Only ADMIN/STAFF
router.post("/", allowRoles("ADMIN", "STAFF"), ctrl.create);
router.put("/:id", allowRoles("ADMIN", "STAFF"), ctrl.update);
router.post("/:id/finalize", allowRoles("ADMIN", "STAFF"), ctrl.finalize);
router.post("/:id/mark-sent", allowRoles("ADMIN", "STAFF"), ctrl.markSent);
router.get("/:id/reminders", allowRoles("ADMIN", "STAFF", "VIEWER"), ctrl.listReminders);
router.post("/:id/reminders", allowRoles("ADMIN", "STAFF"), ctrl.addReminder);
router.post("/:id/send-email", allowRoles("ADMIN", "STAFF"), notifications.sendInvoiceEmail);
router.get("/:id/whatsapp-link", allowRoles("ADMIN", "STAFF"), notifications.whatsappLink);
router.get("/:id/credit-notes", allowRoles("ADMIN", "STAFF", "VIEWER"), creditNotes.listForInvoice);
router.post("/:id/credit-notes", allowRoles("ADMIN"), creditNotes.create);
router.get("/:id/payment-links", allowRoles("ADMIN", "STAFF", "VIEWER"), onlinePayments.list);
router.post("/:id/payment-link", allowRoles("ADMIN", "STAFF"), onlinePayments.create);
router.post("/:id/payment-link/sync", allowRoles("ADMIN", "STAFF"), onlinePayments.sync);
router.get("/:id/audit", allowRoles("ADMIN", "STAFF", "VIEWER"), ctrl.listAudit);

// Only ADMIN
router.post("/:id/cancel", allowRoles("ADMIN"), ctrl.cancel);


module.exports = router;
