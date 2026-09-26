const { z } = require("zod");

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date YYYY-MM-DD");

const milestoneSchema = z.object({
  id: z.coerce.number().int().positive().optional().nullable(),
  title: z.string().trim().min(2, "Milestone ka naam likhein").max(200),
  percent: z.coerce.number().min(0).max(100).optional().nullable(),
  amount: z.coerce.number().min(0).optional().nullable(),
  due_date: isoDate.optional().nullable().or(z.literal("").transform(() => null)),
});

const planSchema = z.object({
  customer_id: z.coerce.number().int().positive(),
  title: z.string().trim().min(2, "Project ka naam likhein").max(200),
  description: z.string().max(1000).optional().nullable(),
  item_id: z.coerce.number().int().positive().optional().nullable(),
  total_amount: z.coerce.number().positive("Total amount > 0 hona chahiye"),
  tax_percent: z.coerce.number().min(0).max(100).default(18),
  split_mode: z.enum(["PERCENT", "AMOUNT"]).default("PERCENT"),
  milestones: z.array(milestoneSchema).min(1, "Kam se kam ek milestone").max(24),
});

const demandEmailSchema = z.object({
  to: z.string().max(500).optional().nullable(),
  cc: z.string().max(500).optional().nullable(),
  message: z.string().max(2000).optional().nullable(),
});

const milestoneInvoiceSchema = z.object({
  invoice_date: isoDate.optional().nullable(),
});

module.exports = { planSchema, demandEmailSchema, milestoneInvoiceSchema };
