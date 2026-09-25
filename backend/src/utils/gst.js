// GST helpers: state codes, GSTIN validation, place-of-supply resolution.

const STATES = [
  ["01", "Jammu and Kashmir"],
  ["02", "Himachal Pradesh"],
  ["03", "Punjab"],
  ["04", "Chandigarh"],
  ["05", "Uttarakhand"],
  ["06", "Haryana"],
  ["07", "Delhi"],
  ["08", "Rajasthan"],
  ["09", "Uttar Pradesh"],
  ["10", "Bihar"],
  ["11", "Sikkim"],
  ["12", "Arunachal Pradesh"],
  ["13", "Nagaland"],
  ["14", "Manipur"],
  ["15", "Mizoram"],
  ["16", "Tripura"],
  ["17", "Meghalaya"],
  ["18", "Assam"],
  ["19", "West Bengal"],
  ["20", "Jharkhand"],
  ["21", "Odisha"],
  ["22", "Chhattisgarh"],
  ["23", "Madhya Pradesh"],
  ["24", "Gujarat"],
  ["26", "Dadra and Nagar Haveli and Daman and Diu"],
  ["27", "Maharashtra"],
  ["29", "Karnataka"],
  ["30", "Goa"],
  ["31", "Lakshadweep"],
  ["32", "Kerala"],
  ["33", "Tamil Nadu"],
  ["34", "Puducherry"],
  ["35", "Andaman and Nicobar Islands"],
  ["36", "Telangana"],
  ["37", "Andhra Pradesh"],
  ["38", "Ladakh"],
  ["97", "Other Territory"],
];

const BY_CODE = new Map(STATES.map(([c, n]) => [c, n]));

function key(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z]/g, "");
}

const ALIASES = {
  up: "09", utterpradesh: "09", uttarpardesh: "09", noida: "09", greaternoida: "09", ghaziabad: "09", lucknow: "09",
  mp: "23", delhincr: "07", newdelhi: "07", nctofdelhi: "07", ncr: "07",
  jk: "01", jandk: "01", orissa: "21", pondicherry: "34", tamilnadu: "33", chattisgarh: "22",
  uttaranchal: "05", uk: "05", hp: "02", ap: "37", tn: "33", wb: "19", gurgaon: "06", gurugram: "06", faridabad: "06",
  andaman: "35", daman: "26", diu: "26", dadra: "26", damananddiu: "26", dadraandnagarhaveli: "26",
  mumbai: "27", bangalore: "29", bengaluru: "29", hyderabad: "36", chennai: "33", kolkata: "19",
};

const BY_KEY = new Map(STATES.map(([c, n]) => [key(n), c]));
for (const [k, c] of Object.entries(ALIASES)) BY_KEY.set(k, c);

/** "uttar pradesh" / "UP" / "Noida" / "09" -> "09"; unknown -> null */
function stateCode(input) {
  const raw = String(input || "").trim();
  if (!raw) return null;
  if (/^\d{2}$/.test(raw) && BY_CODE.has(raw)) return raw;
  const m = raw.match(/^(\d{2})\s*-/); // "09-Uttar Pradesh"
  if (m && BY_CODE.has(m[1])) return m[1];
  return BY_KEY.get(key(raw)) || null;
}

function stateName(code) {
  return BY_CODE.get(code) || null;
}

/** "09-Uttar Pradesh" as used by the GST portal / offline tool */
function posLabel(code) {
  return code && BY_CODE.has(code) ? `${code}-${BY_CODE.get(code)}` : "";
}

const GSTIN_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function gstinCheckChar(first14) {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const v = GSTIN_CHARS.indexOf(first14[i]);
    const p = v * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(p / 36) + (p % 36);
  }
  return GSTIN_CHARS[(36 - (sum % 36)) % 36];
}

/** Returns an error message, or null when the GSTIN is valid */
function gstinError(gstin) {
  const g = String(gstin || "").trim().toUpperCase();
  if (g.length !== 15) return "GSTIN 15 characters ka hona chahiye";
  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(g)) {
    return "GSTIN ka format galat hai (jaise 09AAACB1234C1Z5)";
  }
  if (!BY_CODE.has(g.slice(0, 2))) return `GSTIN ka state code ${g.slice(0, 2)} valid nahi hai`;
  if (gstinCheckChar(g.slice(0, 14)) !== g[14]) return "GSTIN ka check digit galat hai, dobara check karein";
  return null;
}

function isValidGstin(gstin) {
  return gstinError(gstin) === null;
}

/**
 * Place of supply for a customer: a registered customer's GSTIN state wins,
 * otherwise their billing state.
 */
function customerStateCode(customer) {
  if (customer && isValidGstin(customer.gstin)) return String(customer.gstin).trim().slice(0, 2);
  return stateCode(customer?.billing_state);
}

function companyStateCode(company) {
  if (company && isValidGstin(company.gstin)) return String(company.gstin).trim().slice(0, 2);
  return stateCode(company?.billing_state);
}

/** HSN (goods) / SAC (services): 4, 6 or 8 digits */
function isValidHsn(code) {
  return /^(\d{4}|\d{6}|\d{8})$/.test(String(code || "").trim());
}

module.exports = {
  STATES,
  isValidHsn,
  stateCode,
  stateName,
  posLabel,
  gstinError,
  isValidGstin,
  gstinCheckChar,
  customerStateCode,
  companyStateCode,
};
