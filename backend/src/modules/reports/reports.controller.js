const asyncHandler = require("../../utils/asyncHandler");
const service = require("./reports.service");
const exportService = require("./reports.export.service");
const gstService = require("./gst.service");

const dashboard = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;

  const data = await service.dashboard(companyId, {
    from: req.query.from,
    to: req.query.to,
    top: req.query.top,
  });

  res.json({ ok: true, data });
});

const customers = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;
  const data = await service.customers(companyId, { search: req.query.search });
  res.json({ ok: true, data });
});

const customer = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;
  const customerId = Number(req.params.customerId);

  const data = await service.customer(companyId, customerId, {
    limit: req.query.limit,
  });

  res.json({ ok: true, data });
});

const ledger = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;
  const customerId = Number(req.params.customerId);

  const data = await service.ledger(companyId, customerId, {
    limit: req.query.limit,
  });

  if (!data) return res.status(404).json({ ok: false, error: "Customer not found" });
  res.json({ ok: true, data });
});

const exportDashboardXlsx = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;

  const buf = await exportService.dashboardXlsx(companyId, {
    from: req.query.from,
    to: req.query.to,
    top: req.query.top,
  });

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="dashboard_${Date.now()}.xlsx"`
  );
  res.send(Buffer.from(buf));
});

const exportDashboardPdf = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;

  const buf = await exportService.dashboardPdf(companyId, {
    from: req.query.from,
    to: req.query.to,
    top: req.query.top,
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="dashboard_${Date.now()}.pdf"`
  );
  res.send(buf);
});

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const gstr1 = asyncHandler(async (req, res) => {
  const data = await gstService.gstr1(req.user.companyId, req.query.month);
  res.json({ ok: true, data });
});

const gstr1Xlsx = asyncHandler(async (req, res) => {
  const buf = await gstService.gstr1Xlsx(req.user.companyId, req.query.month);
  res.setHeader("Content-Type", XLSX_TYPE);
  res.setHeader("Content-Disposition", `attachment; filename="GSTR1_${String(req.query.month).replace(/[^\d-]/g, "")}.xlsx"`);
  res.send(Buffer.from(buf));
});

const pnl = asyncHandler(async (req, res) => {
  const data = await gstService.pnl(req.user.companyId, { from: req.query.from, to: req.query.to });
  res.json({ ok: true, data });
});

const pnlXlsx = asyncHandler(async (req, res) => {
  const buf = await gstService.pnlXlsx(req.user.companyId, { from: req.query.from, to: req.query.to });
  res.setHeader("Content-Type", XLSX_TYPE);
  res.setHeader("Content-Disposition", `attachment; filename="PnL_${req.query.from}_${req.query.to}.xlsx"`.replace(/[^\w.\-"=; ]/g, ""));
  res.send(Buffer.from(buf));
});

module.exports = {
  gstr1,
  gstr1Xlsx,
  pnl,
  pnlXlsx,
  dashboard,
  customers,
  customer,
  ledger,
  exportDashboardXlsx,
  exportDashboardPdf,
};
