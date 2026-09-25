const ExcelJS = require("exceljs");
const reportsService = require("./reports.service");

async function dashboardXlsx(companyId, query) {
  const data = await reportsService.dashboard(companyId, query);

  const wb = new ExcelJS.Workbook();
  const ws1 = wb.addWorksheet("Summary");
  const ws2 = wb.addWorksheet("Daily Sales");
  const ws3 = wb.addWorksheet("Top Due Customers");

  ws1.addRow(["From", data.range.from]);
  ws1.addRow(["To", data.range.to]);
  ws1.addRow([]);
  ws1.addRow(["Sales Total", data.summary.sales_total]);
  ws1.addRow(["Payments Received", data.summary.payments_received]);
  ws1.addRow(["Total Due", data.summary.due_total]);
  ws1.addRow(["Draft Due", data.summary.draft_due_total || 0]);
  ws1.addRow(["Final Due", data.summary.final_due_total || 0]);
  ws1.addRow([]);
  ws1.addRow(["CGST", data.summary.cgst_total]);
  ws1.addRow(["SGST", data.summary.sgst_total]);
  ws1.addRow(["IGST", data.summary.igst_total]);

  ws2.addRow(["Date", "Sales"]);
  (data.daily || []).forEach((r) => ws2.addRow([r.day, r.sales]));

  ws3.addRow(["Customer", "Due", "Invoices"]);
  (data.topDueCustomers || []).forEach((r) =>
    ws3.addRow([r.customer_name, r.due_total, r.invoice_count])
  );

  const buf = await wb.xlsx.writeBuffer();
  return buf;
}
const puppeteer = require("puppeteer");

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function htmlToPdfBuffer(html) {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    return await page.pdf({ format: "A4", printBackground: true, margin: { top:"10mm", right:"10mm", bottom:"10mm", left:"10mm" } });
  } finally {
    await browser.close();
  }
}

async function dashboardPdf(companyId, query) {
  const data = await reportsService.dashboard(companyId, query);

  const html = `
  <html><head><meta charset="utf-8"/>
    <style>
      body{font-family:Arial;font-size:12px;color:#111}
      .box{border:1px solid #ddd;border-radius:10px;padding:12px;margin-bottom:10px}
      .row{display:flex;gap:10px}
      .col{flex:1}
      table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #ddd;padding:6px}
      th{background:#f7f7f7}
      .r{text-align:right}
    </style>
  </head><body>
    <h2>Dashboard Report</h2>
    <div>Range: <b>${esc(data.range.from)}</b> to <b>${esc(data.range.to)}</b></div>

    <div class="box">
      <div class="row">
        <div class="col"><b>Sales</b><div>₹ ${data.summary.sales_total}</div></div>
        <div class="col"><b>Payments</b><div>₹ ${data.summary.payments_received}</div></div>
        <div class="col"><b>Due</b><div>₹ ${data.summary.due_total}</div><small>Draft: ₹ ${data.summary.draft_due_total || 0} | Final: ₹ ${data.summary.final_due_total || 0}</small></div>
      </div>
      <div class="row" style="margin-top:8px;">
        <div class="col"><b>CGST</b><div>₹ ${data.summary.cgst_total}</div></div>
        <div class="col"><b>SGST</b><div>₹ ${data.summary.sgst_total}</div></div>
        <div class="col"><b>IGST</b><div>₹ ${data.summary.igst_total}</div></div>
      </div>
    </div>

    <div class="box">
      <h3>Daily Sales</h3>
      <table><thead><tr><th>Date</th><th class="r">Sales</th></tr></thead><tbody>
        ${(data.daily||[]).map(r=>`<tr><td>${esc(r.day)}</td><td class="r">₹ ${r.sales}</td></tr>`).join("") || `<tr><td colspan="2">No data</td></tr>`}
      </tbody></table>
    </div>

    <div class="box">
      <h3>Top Due Customers</h3>
      <table><thead><tr><th>Customer</th><th class="r">Due</th><th class="r">Invoices</th></tr></thead><tbody>
        ${(data.topDueCustomers||[]).map(r=>`<tr><td>${esc(r.customer_name)}</td><td class="r">₹ ${r.due_total}</td><td class="r">${r.invoice_count}</td></tr>`).join("") || `<tr><td colspan="3">No dues</td></tr>`}
      </tbody></table>
    </div>
  </body></html>`;

  return htmlToPdfBuffer(html);
}

module.exports = { dashboardXlsx, dashboardPdf };
