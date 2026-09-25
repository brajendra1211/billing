const asyncHandler = require("../../utils/asyncHandler");
const service = require("./payments.service");
const { paymentCreateSchema, paymentDeleteSchema } = require("./payments.validation");
const pdfService = require("../pdf/pdf.service"); // ✅ has generateReceiptPdf
const onlinePayments = require("../onlinePayments/onlinePayments.service");

const listByInvoice = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;
  const invoiceId = Number(req.params.id);

  const data = await service.listByInvoice(companyId, invoiceId);
  res.json({ ok: true, data });
});

const addToInvoice = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;
  const userId = req.user.id;
  const invoiceId = Number(req.params.id);

  const payload = paymentCreateSchema.parse(req.body);
  const out = await service.addToInvoice({ companyId, userId, invoiceId, payload });

  // Fully paid by hand: close any open online payment link so it can't be paid twice
  if (out.due_total <= 0) {
    onlinePayments.cancelOpenLinks(companyId, invoiceId).catch((e) => console.warn("cancel links:", e.message));
  }

  res.json({ ok: true, ...out });
});

const remove = asyncHandler(async (req, res) => {
  const body = paymentDeleteSchema.parse(req.body || {});
  const data = await service.deletePayment({
    companyId: req.user.companyId,
    userId: req.user.id,
    invoiceId: Number(req.params.id),
    paymentId: Number(req.params.pid),
    reason: body.reason,
  });
  res.json({ ok: true, data });
});

const receiptPdf = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;
  const invoiceId = Number(req.params.id);
  const paymentId = Number(req.params.pid); // ✅ pid (matches routes)

  const out = await pdfService.generateReceiptPdf(companyId, invoiceId, paymentId);
  if (!out) return res.status(404).json({ ok: false, error: "Receipt not found" });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `inline; filename="RECEIPT-${out.invoiceNo}-${out.receiptId}.pdf"`
  );
  res.send(out.pdf);
});

module.exports = { listByInvoice, addToInvoice, remove, receiptPdf };
