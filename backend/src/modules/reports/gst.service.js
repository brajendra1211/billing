// GSTR-1 data (sheet layout follows the GST offline tool) and Profit & Loss.
const ExcelJS = require("exceljs");
const pool = require("../../config/db");
const gst = require("../../utils/gst");

const B2CL_LIMIT = 100000; // inter-state B2C invoices above ₹1 lakh go to B2CL (from 1 Aug 2024)

function r2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function gstDate(d) {
  const s = String(d).slice(0, 10); // YYYY-MM-DD
  return `${s.slice(8, 10)}-${MONTHS[Number(s.slice(5, 7)) - 1]}-${s.slice(0, 4)}`;
}

function monthRange(month) {
  if (!/^\d{4}-\d{2}$/.test(String(month || ""))) {
    const err = new Error("month YYYY-MM format mein chahiye");
    err.statusCode = 400;
    throw err;
  }
  const [y, m] = month.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

function uqc(unit, hsn) {
  if (String(hsn || "").startsWith("99")) return "NA"; // services (SAC)
  const u = String(unit || "").toLowerCase();
  if (["nos", "no", "pcs", "pc", "piece", "pieces", "unit", "units"].includes(u)) return "NOS-NUMBERS";
  return "OTH-OTHERS";
}

/** Sum line taxes by GST rate */
function byRate(lines) {
  const m = new Map();
  for (const l of lines) {
    const rate = Number(l.tax_percent);
    const cur = m.get(rate) || { rate, taxable: 0, igst: 0, cgst: 0, sgst: 0 };
    cur.taxable = r2(cur.taxable + Number(l.taxable_amount));
    cur.igst = r2(cur.igst + Number(l.igst_amount));
    cur.cgst = r2(cur.cgst + Number(l.cgst_amount));
    cur.sgst = r2(cur.sgst + Number(l.sgst_amount));
    m.set(rate, cur);
  }
  return [...m.values()];
}

async function gstr1(companyId, month) {
  const { from, to } = monthRange(month);
  const warnings = [];

  const [[company]] = await pool.query("SELECT name, gstin, billing_state FROM companies WHERE id=?", [companyId]);
  const companyCode = gst.companyStateCode(company);
  if (!gst.isValidGstin(company.gstin)) warnings.push(`Company GSTIN "${company.gstin || ""}" valid nahi hai. Company Settings mein sahi GSTIN daalein.`);

  const [invoices] = await pool.query(
    `SELECT i.id, i.invoice_no, i.invoice_date, i.place_of_supply_state, i.is_interstate, i.grand_total,
            c.name AS cust_name, c.gstin AS cust_gstin, c.billing_state AS cust_state
     FROM invoices i JOIN customers c ON c.id=i.customer_id
     WHERE i.company_id=? AND i.status='FINAL' AND i.invoice_date BETWEEN ? AND ?
     ORDER BY i.invoice_date, i.id`,
    [companyId, from, to]
  );
  const [notes] = await pool.query(
    `SELECT cn.*, i.invoice_no, i.grand_total AS inv_total, i.is_interstate AS inv_interstate,
            i.place_of_supply_state AS inv_pos,
            c.name AS cust_name, c.gstin AS cust_gstin, c.billing_state AS cust_state
     FROM credit_notes cn
     JOIN invoices i ON i.id=cn.invoice_id
     JOIN customers c ON c.id=cn.customer_id
     WHERE cn.company_id=? AND cn.cn_date BETWEEN ? AND ?
     ORDER BY cn.cn_date, cn.id`,
    [companyId, from, to]
  );

  const invIds = invoices.map((i) => i.id);
  const noteIds = notes.map((n) => n.id);
  const [invItems] = invIds.length
    ? await pool.query("SELECT * FROM invoice_items WHERE invoice_id IN (?)", [invIds])
    : [[]];
  const [noteItems] = noteIds.length
    ? await pool.query("SELECT * FROM credit_note_items WHERE credit_note_id IN (?)", [noteIds])
    : [[]];
  const itemsOf = (rows, key, id) => rows.filter((r) => Number(r[key]) === Number(id));

  const posOf = (pos, cust, label) => {
    const code = gst.stateCode(pos) || gst.customerStateCode({ gstin: cust.cust_gstin, billing_state: cust.cust_state });
    if (!code) warnings.push(`${label}: place of supply pata nahi, company state maana gaya`);
    return code || companyCode;
  };

  const b2b = [], b2cl = [], cdnr = [], cdnur = [];
  const b2cs = new Map(); // `${pos}|${rate}` -> row
  const hsn = { B2B: new Map(), B2C: new Map() };
  const invalidGstinCustomers = new Set();
  let missingHsnLines = 0;

  const badHsn = new Set();
  const addHsn = (bucket, line, sign) => {
    const code = line.hsn_sac ? String(line.hsn_sac).trim() : "";
    if (!code) missingHsnLines++;
    else if (!gst.isValidHsn(code)) badHsn.add(code);
    const k = `${code || "MISSING"}|${Number(line.tax_percent)}`;
    const cur = hsn[bucket].get(k) || {
      hsn: code || "MISSING", description: String(line.description || "").slice(0, 30), uqc: uqc(line.unit, code),
      qty: 0, value: 0, rate: Number(line.tax_percent), taxable: 0, igst: 0, cgst: 0, sgst: 0,
    };
    cur.qty = r2(cur.qty + sign * Number(line.qty));
    cur.taxable = r2(cur.taxable + sign * Number(line.taxable_amount));
    cur.igst = r2(cur.igst + sign * Number(line.igst_amount));
    cur.cgst = r2(cur.cgst + sign * Number(line.cgst_amount));
    cur.sgst = r2(cur.sgst + sign * Number(line.sgst_amount));
    cur.value = r2(cur.taxable + cur.igst + cur.cgst + cur.sgst);
    hsn[bucket].set(k, cur);
  };

  const addB2cs = (posCode, rate, taxable, sign) => {
    const k = `${posCode}|${rate}`;
    const cur = b2cs.get(k) || { type: "OE", pos: gst.posLabel(posCode), rate, taxable: 0 };
    cur.taxable = r2(cur.taxable + sign * taxable);
    b2cs.set(k, cur);
  };

  for (const inv of invoices) {
    const lines = itemsOf(invItems, "invoice_id", inv.id);
    const registered = gst.isValidGstin(inv.cust_gstin);
    if (inv.cust_gstin && !registered) invalidGstinCustomers.add(`${inv.cust_name} (${inv.cust_gstin})`);
    const pos = posOf(inv.place_of_supply_state, inv, `Invoice ${inv.invoice_no}`);
    const inter = Number(inv.is_interstate) === 1;

    for (const g of byRate(lines)) {
      if (registered) {
        b2b.push({
          gstin: String(inv.cust_gstin).toUpperCase(), name: inv.cust_name, no: inv.invoice_no, date: gstDate(inv.invoice_date),
          value: r2(inv.grand_total), pos: gst.posLabel(pos), rc: "N", type: "Regular B2B", rate: g.rate, taxable: g.taxable,
        });
      } else if (inter && Number(inv.grand_total) > B2CL_LIMIT) {
        b2cl.push({ no: inv.invoice_no, date: gstDate(inv.invoice_date), value: r2(inv.grand_total), pos: gst.posLabel(pos), rate: g.rate, taxable: g.taxable });
      } else {
        addB2cs(pos, g.rate, g.taxable, 1);
      }
    }
    for (const l of lines) addHsn(registered ? "B2B" : "B2C", l, 1);
  }

  for (const n of notes) {
    const lines = itemsOf(noteItems, "credit_note_id", n.id);
    const registered = gst.isValidGstin(n.cust_gstin);
    const pos = posOf(n.inv_pos, n, `Credit note ${n.cn_no}`);
    const origB2cl = !registered && Number(n.inv_interstate) === 1 && Number(n.inv_total) > B2CL_LIMIT;

    for (const g of byRate(lines)) {
      if (registered) {
        cdnr.push({
          gstin: String(n.cust_gstin).toUpperCase(), name: n.cust_name, no: n.cn_no, date: gstDate(n.cn_date), noteType: "C",
          pos: gst.posLabel(pos), rc: "N", supplyType: "Regular B2B", value: r2(n.grand_total), rate: g.rate, taxable: g.taxable,
        });
      } else if (origB2cl) {
        cdnur.push({ urType: "B2CL", no: n.cn_no, date: gstDate(n.cn_date), noteType: "C", pos: gst.posLabel(pos), value: r2(n.grand_total), rate: g.rate, taxable: g.taxable });
      } else {
        addB2cs(pos, g.rate, g.taxable, -1); // B2CS is reported net of credit notes
      }
    }
    for (const l of lines) addHsn(registered ? "B2B" : "B2C", l, -1);
  }

  if (invalidGstinCustomers.size) {
    warnings.push(`In customers ka GSTIN galat hai, isliye unregistered (B2C) maana gaya: ${[...invalidGstinCustomers].join(", ")}`);
  }
  if (badHsn.size) warnings.push(`Galat HSN/SAC code: ${[...badHsn].join(", ")}. 4/6/8 digit ka sahi code items mein daalein.`);
  if (missingHsnLines) warnings.push(`${missingHsnLines} line(s) mein HSN/SAC code nahi hai (HSN sheet mein "MISSING"). Items mein HSN/SAC daalein.`);

  const [[drafts]] = await pool.query(
    "SELECT COUNT(*) n FROM invoices WHERE company_id=? AND status='DRAFT' AND invoice_date BETWEEN ? AND ?",
    [companyId, from, to]
  );
  if (drafts.n) warnings.push(`${drafts.n} DRAFT invoice(s) is mahine ke hain. Ye GSTR-1 mein shaamil nahi hain; zaroorat ho to pehle Finalize karein.`);

  const docs = [];
  const series = (rows, noKey, label) => {
    if (!rows.length) return;
    const sorted = [...rows].sort((a, b) => String(a[noKey]).localeCompare(String(b[noKey])));
    docs.push({ nature: label, from: sorted[0][noKey], to: sorted[sorted.length - 1][noKey], total: rows.length, cancelled: 0 });
  };
  series(invoices, "invoice_no", "Invoices for outward supply");
  series(notes, "cn_no", "Credit Note");

  const sum = (rows, k) => r2(rows.reduce((s, x) => s + Number(x[k] || 0), 0));
  const b2csRows = [...b2cs.values()].filter((x) => Math.abs(x.taxable) > 0.001);
  const taxFromInvoices = byRate(invItems);
  const taxFromNotes = byRate(noteItems);

  return {
    period: { month, from, to },
    company: { name: company.name, gstin: company.gstin },
    summary: {
      invoices: invoices.length,
      credit_notes: notes.length,
      b2b_taxable: sum(b2b, "taxable"),
      b2cl_taxable: sum(b2cl, "taxable"),
      b2cs_taxable: sum(b2csRows, "taxable"),
      cdnr_taxable: sum(cdnr, "taxable"),
      cdnur_taxable: sum(cdnur, "taxable"),
      igst: r2(sum(taxFromInvoices, "igst") - sum(taxFromNotes, "igst")),
      cgst: r2(sum(taxFromInvoices, "cgst") - sum(taxFromNotes, "cgst")),
      sgst: r2(sum(taxFromInvoices, "sgst") - sum(taxFromNotes, "sgst")),
    },
    b2b,
    b2cl,
    b2cs: b2csRows,
    cdnr,
    cdnur,
    hsn_b2b: [...hsn.B2B.values()],
    hsn_b2c: [...hsn.B2C.values()],
    docs,
    warnings,
  };
}

function sheet(wb, name, columns, rows) {
  const ws = wb.addWorksheet(name);
  ws.columns = columns.map(([header, key, width]) => ({ header, key, width: width || 16 }));
  ws.getRow(1).font = { bold: true };
  rows.forEach((r) => ws.addRow(r));
  return ws;
}

async function gstr1Xlsx(companyId, month) {
  const d = await gstr1(companyId, month);
  const wb = new ExcelJS.Workbook();

  const s = wb.addWorksheet("summary");
  s.columns = [{ width: 32 }, { width: 22 }];
  [
    ["GSTR-1", d.period.month],
    ["Company", d.company.name],
    ["GSTIN", d.company.gstin],
    ["Period", `${d.period.from} to ${d.period.to}`],
    [],
    ["Invoices", d.summary.invoices],
    ["Credit notes", d.summary.credit_notes],
    ["B2B taxable", d.summary.b2b_taxable],
    ["B2CL taxable", d.summary.b2cl_taxable],
    ["B2CS taxable (net)", d.summary.b2cs_taxable],
    ["CDNR taxable", d.summary.cdnr_taxable],
    ["CDNUR taxable", d.summary.cdnur_taxable],
    ["IGST (net)", d.summary.igst],
    ["CGST (net)", d.summary.cgst],
    ["SGST (net)", d.summary.sgst],
  ].forEach((r) => s.addRow(r));
  s.getColumn(1).font = { bold: true };

  sheet(wb, "b2b", [
    ["GSTIN/UIN of Recipient", "gstin", 20], ["Receiver Name", "name", 30], ["Invoice Number", "no", 22], ["Invoice date", "date", 14],
    ["Invoice Value", "value"], ["Place Of Supply", "pos", 22], ["Reverse Charge", "rc", 10], ["Applicable % of Tax Rate", "applicable", 10],
    ["Invoice Type", "type", 14], ["E-Commerce GSTIN", "ecom", 12], ["Rate", "rate", 8], ["Taxable Value", "taxable"], ["Cess Amount", "cess", 10],
  ], d.b2b);
  sheet(wb, "b2cl", [
    ["Invoice Number", "no", 22], ["Invoice date", "date", 14], ["Invoice Value", "value"], ["Place Of Supply", "pos", 22],
    ["Applicable % of Tax Rate", "applicable", 10], ["Rate", "rate", 8], ["Taxable Value", "taxable"], ["Cess Amount", "cess", 10], ["E-Commerce GSTIN", "ecom", 12],
  ], d.b2cl);
  sheet(wb, "b2cs", [
    ["Type", "type", 8], ["Place Of Supply", "pos", 22], ["Applicable % of Tax Rate", "applicable", 10], ["Rate", "rate", 8],
    ["Taxable Value", "taxable"], ["Cess Amount", "cess", 10], ["E-Commerce GSTIN", "ecom", 12],
  ], d.b2cs);
  sheet(wb, "cdnr", [
    ["GSTIN/UIN of Recipient", "gstin", 20], ["Receiver Name", "name", 30], ["Note Number", "no", 22], ["Note Date", "date", 14],
    ["Note Type", "noteType", 8], ["Place Of Supply", "pos", 22], ["Reverse Charge", "rc", 10], ["Note Supply Type", "supplyType", 14],
    ["Note Value", "value"], ["Applicable % of Tax Rate", "applicable", 10], ["Rate", "rate", 8], ["Taxable Value", "taxable"], ["Cess Amount", "cess", 10],
  ], d.cdnr);
  sheet(wb, "cdnur", [
    ["UR Type", "urType", 8], ["Note Number", "no", 22], ["Note Date", "date", 14], ["Note Type", "noteType", 8], ["Place Of Supply", "pos", 22],
    ["Note Value", "value"], ["Applicable % of Tax Rate", "applicable", 10], ["Rate", "rate", 8], ["Taxable Value", "taxable"], ["Cess Amount", "cess", 10],
  ], d.cdnur);
  const hsnCols = [
    ["HSN", "hsn", 12], ["Description", "description", 30], ["UQC", "uqc", 14], ["Total Quantity", "qty", 12], ["Total Value", "value"],
    ["Rate", "rate", 8], ["Taxable Value", "taxable"], ["Integrated Tax Amount", "igst"], ["Central Tax Amount", "cgst"],
    ["State/UT Tax Amount", "sgst"], ["Cess Amount", "cess", 10],
  ];
  sheet(wb, "hsn(b2b)", hsnCols, d.hsn_b2b);
  sheet(wb, "hsn(b2c)", hsnCols, d.hsn_b2c);
  sheet(wb, "docs", [
    ["Nature of Document", "nature", 30], ["Sr. No. From", "from", 22], ["Sr. No. To", "to", 22], ["Total Number", "total", 12], ["Cancelled", "cancelled", 10],
  ], d.docs);
  const w = wb.addWorksheet("warnings");
  w.columns = [{ header: "Check before filing", key: "w", width: 120 }];
  w.getRow(1).font = { bold: true };
  (d.warnings.length ? d.warnings : ["No issues found"]).forEach((x) => w.addRow({ w: x }));

  return wb.xlsx.writeBuffer();
}

/* ---------------- Profit & Loss ---------------- */

async function pnl(companyId, { from, to }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(from || "")) || !/^\d{4}-\d{2}-\d{2}$/.test(String(to || ""))) {
    const err = new Error("from/to YYYY-MM-DD format mein chahiye");
    err.statusCode = 400;
    throw err;
  }
  const q = async (sql, params) => (await pool.query(sql, params))[0];
  const ym = (col) => `DATE_FORMAT(${col}, '%Y-%m')`;

  const sales = await q(
    `SELECT ${ym("invoice_date")} AS m, COALESCE(SUM(taxable_total),0) AS v
     FROM invoices WHERE company_id=? AND status='FINAL' AND invoice_date BETWEEN ? AND ? GROUP BY m`,
    [companyId, from, to]
  );
  const credits = await q(
    `SELECT ${ym("cn_date")} AS m, COALESCE(SUM(taxable_total),0) AS v
     FROM credit_notes WHERE company_id=? AND cn_date BETWEEN ? AND ? GROUP BY m`,
    [companyId, from, to]
  );
  const expenses = await q(
    `SELECT ${ym("e.expense_date")} AS m, COALESCE(c.name,'Uncategorised') AS category, COALESCE(SUM(e.amount),0) AS v
     FROM expenses e LEFT JOIN expense_categories c ON c.id=e.category_id
     WHERE e.company_id=? AND e.expense_date BETWEEN ? AND ? GROUP BY m, category`,
    [companyId, from, to]
  );
  const vendor = await q(
    `SELECT ${ym("from_date")} AS m, COALESCE(SUM(subtotal),0) AS v
     FROM vendor_bills WHERE company_id=? AND from_date BETWEEN ? AND ? GROUP BY m`,
    [companyId, from, to]
  );
  const renewals = await q(
    `SELECT ${ym("paid_date")} AS m, COALESCE(SUM(amount),0) AS v
     FROM recurring_payments WHERE company_id=? AND paid_date BETWEEN ? AND ? GROUP BY m`,
    [companyId, from, to]
  );

  const months = new Map();
  const row = (m) => {
    if (!months.has(m)) months.set(m, { month: m, sales: 0, credit_notes: 0, income: 0, expenses: 0, vendor_bills: 0, renewal_costs: 0, total_costs: 0, net_profit: 0 });
    return months.get(m);
  };
  sales.forEach((x) => (row(x.m).sales = r2(x.v)));
  credits.forEach((x) => (row(x.m).credit_notes = r2(x.v)));
  expenses.forEach((x) => (row(x.m).expenses = r2(row(x.m).expenses + Number(x.v))));
  vendor.forEach((x) => (row(x.m).vendor_bills = r2(x.v)));
  renewals.forEach((x) => (row(x.m).renewal_costs = r2(x.v)));

  const list = [...months.values()].sort((a, b) => (a.month < b.month ? -1 : 1));
  for (const m of list) {
    m.income = r2(m.sales - m.credit_notes);
    m.total_costs = r2(m.expenses + m.vendor_bills + m.renewal_costs);
    m.net_profit = r2(m.income - m.total_costs);
  }

  const keys = ["sales", "credit_notes", "income", "expenses", "vendor_bills", "renewal_costs", "total_costs", "net_profit"];
  const totals = Object.fromEntries(keys.map((k) => [k, r2(list.reduce((s, m) => s + m[k], 0))]));
  const byCategory = new Map();
  expenses.forEach((x) => byCategory.set(x.category, r2((byCategory.get(x.category) || 0) + Number(x.v))));

  return {
    range: { from, to },
    months: list,
    totals,
    expenses_by_category: [...byCategory.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount),
    note: "Income = FINAL invoices ka taxable amount (GST ke bina) minus credit notes. Costs = expenses + vendor bills + renewal payments.",
  };
}

async function pnlXlsx(companyId, range) {
  const d = await pnl(companyId, range);
  const wb = new ExcelJS.Workbook();
  sheet(wb, "Profit & Loss", [
    ["Month", "month", 10], ["Sales (taxable)", "sales"], ["Credit notes", "credit_notes"], ["Income", "income"],
    ["Expenses", "expenses"], ["Vendor bills", "vendor_bills"], ["Renewal costs", "renewal_costs"], ["Total costs", "total_costs"], ["Net profit", "net_profit"],
  ], [...d.months, { month: "TOTAL", ...d.totals }]);
  sheet(wb, "Expenses by category", [["Category", "category", 30], ["Amount", "amount"]], d.expenses_by_category);
  return wb.xlsx.writeBuffer();
}

module.exports = { gstr1, gstr1Xlsx, pnl, pnlXlsx, monthRange };
