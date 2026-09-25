const { z } = require("zod");
const { partialUpdate } = require("../../utils/zodPartial");

const renewalCreateSchema = z.object({
  customer_id: z.number().int().positive().optional().nullable(),
  name: z.string().min(2).max(120),
  service_type: z.enum(["DOMAIN","HOSTING","SERVER","SSL","SOFTWARE","AMC","OTHER"]).default("OTHER"),
  service_ref: z.string().max(150).optional().nullable(),
  provider_name: z.string().max(120).optional().nullable(),
  amount: z.number().positive(),
  currency: z.string().max(10).optional().default("INR"),
  cycle: z.enum(["MONTHLY","QUARTERLY","HALF_YEARLY","YEARLY"]).default("YEARLY"),
  start_date: z.string().min(10),
  next_due_date: z.string().min(10),
  remind_before_days: z.number().int().min(0).max(60).default(7),
  is_active: z.number().int().optional().default(1),
  notes: z.string().max(255).optional().nullable(),
});

const renewalUpdateSchema = partialUpdate(renewalCreateSchema);

const paymentCreateSchema = z.object({
  paid_date: z.string().min(10),
  amount: z.number().positive(),
  mode: z.enum(["CASH","UPI","BANK","CARD","OTHER"]).default("UPI"),
  reference_no: z.string().max(80).optional().nullable(),
  notes: z.string().max(255).optional().nullable(),
});

const invoiceFromRenewalSchema = z.object({
  invoice_date: z.string().min(8).optional(),
  due_date: z.string().min(8).optional().nullable(),
  item_id: z.coerce.number().positive().optional(),
  tax_percent: z.coerce.number().min(0).max(100).optional().default(18),
  notes: z.string().max(500).optional().nullable(),
});

module.exports = { renewalCreateSchema, renewalUpdateSchema, paymentCreateSchema, invoiceFromRenewalSchema };
