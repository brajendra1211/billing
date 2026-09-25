const asyncHandler = require("../../utils/asyncHandler");
const service = require("./pdf.service");

const invoicePdf = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;
  const invoiceId = Number(req.params.id);

  const out = await service.generateInvoicePdf(companyId, invoiceId);
  if (!out) return res.status(404).json({ ok: false, error: "Invoice not found" });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${out.invoiceNo}.pdf"`);
  res.send(out.pdf);
});

const receiptPdf = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;
  const invoiceId = Number(req.params.id);
  const paymentId = Number(req.params.paymentId);

  const out = await service.generateReceiptPdf(companyId, invoiceId, paymentId);
  if (!out) return res.status(404).json({ ok: false, error: "Receipt not found" });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="RECEIPT-${out.invoiceNo}-${out.receiptId}.pdf"`);
  res.send(out.pdf);
});

module.exports = { invoicePdf, receiptPdf };
