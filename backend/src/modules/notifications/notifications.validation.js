const { z } = require("zod");

const emailList = z
  .string()
  .max(500)
  .refine(
    (s) => s.split(",").map((x) => x.trim()).filter(Boolean).every((e) => z.string().email().safeParse(e).success),
    "Invalid email address"
  );

const sendInvoiceEmailSchema = z.object({
  to: emailList.optional().nullable(),
  cc: emailList.optional().nullable(),
  message: z.string().max(2000).optional().nullable(),
});

const settingsSchema = z.object({
  auto_reminders: z.coerce.number().int().min(0).max(1),
  reminder_days: z.string().max(60).default("3,7,15"),
  renewal_alerts: z.coerce.number().int().min(0).max(1),
  renewal_auto_invoice: z.coerce.number().int().min(0).max(1),
  renewal_invoice_days_before: z.coerce.number().int().min(0).max(60).default(7),
});

const testEmailSchema = z.object({
  to: z.string().email().optional().nullable(),
});

module.exports = { sendInvoiceEmailSchema, settingsSchema, testEmailSchema };
