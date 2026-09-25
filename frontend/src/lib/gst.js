// Mirrors backend/src/utils/gst.js (the backend is the source of truth; this is for UI hints)

export const STATES = [
  ["01", "Jammu and Kashmir"], ["02", "Himachal Pradesh"], ["03", "Punjab"], ["04", "Chandigarh"],
  ["05", "Uttarakhand"], ["06", "Haryana"], ["07", "Delhi"], ["08", "Rajasthan"], ["09", "Uttar Pradesh"],
  ["10", "Bihar"], ["11", "Sikkim"], ["12", "Arunachal Pradesh"], ["13", "Nagaland"], ["14", "Manipur"],
  ["15", "Mizoram"], ["16", "Tripura"], ["17", "Meghalaya"], ["18", "Assam"], ["19", "West Bengal"],
  ["20", "Jharkhand"], ["21", "Odisha"], ["22", "Chhattisgarh"], ["23", "Madhya Pradesh"], ["24", "Gujarat"],
  ["26", "Dadra and Nagar Haveli and Daman and Diu"], ["27", "Maharashtra"], ["29", "Karnataka"], ["30", "Goa"],
  ["31", "Lakshadweep"], ["32", "Kerala"], ["33", "Tamil Nadu"], ["34", "Puducherry"],
  ["35", "Andaman and Nicobar Islands"], ["36", "Telangana"], ["37", "Andhra Pradesh"], ["38", "Ladakh"],
  ["97", "Other Territory"],
];

const key = (s) => String(s || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z]/g, "");
const ALIASES = {
  up: "09", utterpradesh: "09", noida: "09", greaternoida: "09", ghaziabad: "09", lucknow: "09", mp: "23",
  newdelhi: "07", delhincr: "07", ncr: "07", orissa: "21", pondicherry: "34", uttaranchal: "05",
  gurgaon: "06", gurugram: "06", faridabad: "06", mumbai: "27", bangalore: "29", bengaluru: "29",
};
const BY_KEY = new Map(STATES.map(([c, n]) => [key(n), c]));
Object.entries(ALIASES).forEach(([k, c]) => BY_KEY.set(k, c));

export function stateCode(input) {
  const raw = String(input || "").trim();
  if (!raw) return null;
  if (/^\d{2}$/.test(raw) && STATES.some(([c]) => c === raw)) return raw;
  return BY_KEY.get(key(raw)) || null;
}

export function stateName(code) {
  return STATES.find(([c]) => c === code)?.[1] || null;
}

/** Standard name for a stored value ("uttar pradesh" -> "Uttar Pradesh"), or the value itself */
export function canonicalState(value) {
  return stateName(stateCode(value)) || value || "";
}

const CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
export function gstinError(gstin) {
  const g = String(gstin || "").trim().toUpperCase();
  if (!g) return null;
  if (g.length !== 15) return "GSTIN 15 characters ka hona chahiye";
  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(g)) return "GSTIN ka format galat hai";
  if (!stateName(g.slice(0, 2))) return "GSTIN ka state code galat hai";
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const p = CHARS.indexOf(g[i]) * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(p / 36) + (p % 36);
  }
  if (CHARS[(36 - (sum % 36)) % 36] !== g[14]) return "GSTIN ka check digit galat hai";
  return null;
}

/** Customer's place of supply: GSTIN state (registered) else billing state */
export function customerStateCode(customer) {
  if (customer?.gstin && !gstinError(customer.gstin)) return String(customer.gstin).trim().slice(0, 2);
  return stateCode(customer?.billing_state);
}

export function companyStateCode(company) {
  if (company?.gstin && !gstinError(company.gstin)) return String(company.gstin).trim().slice(0, 2);
  return stateCode(company?.billing_state);
}
