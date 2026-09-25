function getFinancialYear(dateObj) {
  const d = new Date(dateObj);
  const year = d.getFullYear();
  const month = d.getMonth() + 1; // 1-12
  // FY in India: Apr(4) to Mar(3)
  const startYear = month >= 4 ? year : year - 1;
  const endYearShort = String((startYear + 1) % 100).padStart(2, "0");
  return `${startYear}-${endYearShort}`; // e.g. 2025-26
}

function formatInvoiceNo(prefix, fy, num) {
  return `${prefix}/${fy}/${String(num).padStart(6, "0")}`;
}

module.exports = { getFinancialYear, formatInvoiceNo };
