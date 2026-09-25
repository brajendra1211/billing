const nodemailer = require("nodemailer");

let transporter = null;

function isMailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter() {
  if (!isMailConfigured()) {
    const err = new Error("Email (SMTP) configured nahi hai. backend/.env mein SMTP_HOST, SMTP_USER, SMTP_PASS set karein.");
    err.statusCode = 400;
    throw err;
  }
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT || 587);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: String(process.env.SMTP_SECURE || (port === 465 ? "true" : "false")) === "true",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

/** fromName: shown as sender name, e.g. the company name */
async function sendMail({ fromName, to, cc, bcc, replyTo, subject, html, text, attachments }) {
  const t = getTransporter();
  const fromAddr = process.env.MAIL_FROM || process.env.SMTP_USER;
  const from = fromName ? `"${String(fromName).replaceAll('"', "")}" <${fromAddr}>` : fromAddr;
  return t.sendMail({ from, to, cc, bcc, replyTo, subject, html, text, attachments });
}

module.exports = { isMailConfigured, sendMail };
