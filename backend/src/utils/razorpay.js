// Minimal Razorpay Payment Links client (https://razorpay.com/docs/api/payments/payment-links/)
const crypto = require("crypto");

const API = "https://api.razorpay.com/v1";

function isConfigured() {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

function httpError(status, message) {
  const err = new Error(message);
  err.statusCode = status;
  return err;
}

async function call(method, path, body) {
  if (!isConfigured()) {
    throw httpError(400, "Online payment (Razorpay) configured nahi hai. backend/.env mein RAZORPAY_KEY_ID aur RAZORPAY_KEY_SECRET set karein.");
  }
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw httpError(502, `Razorpay: ${data?.error?.description || `HTTP ${res.status}`}`);
  }
  return data;
}

/** amount in rupees; returns Razorpay payment_link entity ({ id, short_url, status, ... }) */
async function createPaymentLink({ amount, description, customer, referenceId, callbackUrl, notes }) {
  return call("POST", "/payment_links", {
    amount: Math.round(Number(amount) * 100), // paise
    currency: "INR",
    accept_partial: false,
    description: String(description || "").slice(0, 2048),
    reference_id: referenceId,
    customer,
    notify: { sms: false, email: false }, // we send our own messages
    reminder_enable: false,
    notes,
    ...(callbackUrl ? { callback_url: callbackUrl, callback_method: "get" } : {}),
  });
}

async function fetchPaymentLink(linkId) {
  return call("GET", `/payment_links/${encodeURIComponent(linkId)}`);
}

async function cancelPaymentLink(linkId) {
  return call("POST", `/payment_links/${encodeURIComponent(linkId)}/cancel`);
}

/** Webhook body must be the exact raw bytes Razorpay sent */
function verifyWebhookSignature(rawBody, signature) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { isConfigured, createPaymentLink, fetchPaymentLink, cancelPaymentLink, verifyWebhookSignature };
