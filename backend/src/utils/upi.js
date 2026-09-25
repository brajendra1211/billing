const QRCode = require("qrcode");

// UPI IDs (VPA) look like name@bank, e.g. 9876543210@ybl
function isValidUpiId(upiId) {
  return /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(String(upiId || "").trim());
}

function upiUri({ upiId, payeeName, amount, note }) {
  const params = new URLSearchParams();
  params.set("pa", String(upiId).trim());
  if (payeeName) params.set("pn", String(payeeName).slice(0, 50));
  if (Number(amount) > 0) params.set("am", Number(amount).toFixed(2));
  params.set("cu", "INR");
  if (note) params.set("tn", String(note).slice(0, 80));
  // UPI apps expect %20 rather than + for spaces
  return `upi://pay?${params.toString().replaceAll("+", "%20")}`;
}

/** Returns a PNG data URI, or "" when the UPI ID is missing/invalid or nothing is due. */
async function upiQrDataUri({ upiId, payeeName, amount, note }) {
  if (!isValidUpiId(upiId) || !(Number(amount) > 0)) return "";
  return QRCode.toDataURL(upiUri({ upiId, payeeName, amount, note }), { margin: 1, width: 240 });
}

module.exports = { isValidUpiId, upiUri, upiQrDataUri };
