const asyncHandler = require("../../utils/asyncHandler");
const service = require("./reports.service");
const exportService = require("./reports.export.service");

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

module.exports = {
  dashboard,
  customers,
  customer,
  ledger,
  exportDashboardXlsx,
  exportDashboardPdf,
};
