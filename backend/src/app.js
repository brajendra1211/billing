const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");

const notFound = require("./middlewares/notFound");
const errorHandler = require("./middlewares/errorHandler");

const authRoutes = require("./modules/auth/auth.routes");
const customersRoutes = require("./modules/customers/customers.routes");
const itemsRoutes = require("./modules/items/items.routes");
const invoicesRoutes = require("./modules/invoices/invoices.routes");
const paymentsRoutes = require("./modules/payments/payments.routes");
const pdfRoutes = require("./modules/pdf/pdf.routes");
const companyRoutes = require("./modules/company/company.routes");
const reportsRoutes = require("./modules/reports/reports.routes");
const usersRoutes = require("./modules/users/users.routes");
const expensesRoutes = require("./modules/expenses/expenses.routes");
const vendorRoutes = require("./modules/vendors/vendors.routes");
const renewalsRoutes = require("./modules/renewals/renewals.routes");
const notificationsRoutes = require("./modules/notifications/notifications.routes");
const creditNotesRoutes = require("./modules/creditNotes/creditNotes.routes");
const portalRoutes = require("./modules/portal/portal.routes");
const onlinePaymentsCtrl = require("./modules/onlinePayments/onlinePayments.controller");



// ✅ FIX: import both
const { authRequired, allowRoles } = require("./middlewares/auth");

const app = express();

// Static uploads
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// Security + basics
app.use(helmet());
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
  })
);
app.use(cors());

// Razorpay webhook needs the raw body for signature check, so it goes before express.json()
app.post("/api/webhooks/razorpay", express.raw({ type: "*/*", limit: "1mb" }), onlinePaymentsCtrl.webhook);

app.use(express.json({ limit: "1mb" }));

// Health
app.get("/api/health", (req, res) => res.json({ ok: true }));

// Public
app.use("/api/auth", authRoutes);
app.use("/api/portal", portalRoutes); // customer portal, secured by secret token

// Protected
app.use("/api/customers", authRequired, allowRoles("ADMIN", "STAFF"), customersRoutes);
app.use("/api/items", authRequired, allowRoles("ADMIN", "STAFF"), itemsRoutes);

app.use("/api/invoices", authRequired, invoicesRoutes);
app.use("/api", authRequired, paymentsRoutes);
app.use("/api", authRequired, pdfRoutes);
app.use("/api/company", authRequired, companyRoutes);
app.use("/api/reports", authRequired, reportsRoutes);
app.use("/api/users", authRequired, usersRoutes);
app.use("/api/expenses", authRequired, expensesRoutes);
app.use("/api/vendors", authRequired, vendorRoutes);
app.use("/api/renewals", authRequired, renewalsRoutes);
app.use("/api/notifications", authRequired, notificationsRoutes);
app.use("/api/credit-notes", authRequired, creditNotesRoutes);




// 404 + error handler
app.use(notFound);
app.use(errorHandler);

module.exports = app;
