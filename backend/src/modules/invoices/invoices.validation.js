const { z } = require("zod");

// ✅ Create Invoice
const invoiceCreateSchema = z.object({
  customer_id: z.coerce.number(),
  invoice_date: z.string().min(8), // "YYYY-MM-DD"
  due_date: z.string().optional().nullable(),
  place_of_supply_state: z.string().optional().nullable(),
  is_interstate: z.coerce.number().optional().default(0),

  notes: z.string().optional().nullable(),
  terms: z.string().optional().nullable(),

  items: z
    .array(
      z.object({
        item_id: z.coerce.number(),
        qty: z.coerce.number().positive().default(1),
        rate: z.coerce.number().nonnegative().default(0),
        billing_months: z.coerce.number().positive().optional().default(1),
        discount_percent: z.coerce.number().min(0).max(100).optional().default(0),
        tax_percent: z.coerce.number().min(0).max(100).optional().default(18),
        description: z.string().optional().nullable(),
      })
    )
    .min(1, "At least 1 item required"),
});

// ✅ Update Invoice (DRAFT only in service/controller logic)
const invoiceUpdateSchema = z
  .object({
    customer_id: z.coerce.number().optional(),
    invoice_date: z.string().min(8).optional(),
    due_date: z.string().optional().nullable(),
    place_of_supply_state: z.string().optional().nullable(),
    is_interstate: z.coerce.number().optional(),

    notes: z.string().optional().nullable(),
    terms: z.string().optional().nullable(),

    // optional: if you allow updating items in same request
    items: z
      .array(
        z.object({
          item_id: z.coerce.number(),
          qty: z.coerce.number().positive().default(1),
          rate: z.coerce.number().nonnegative().default(0),
          billing_months: z.coerce.number().positive().optional().default(1),
          discount_percent: z.coerce.number().min(0).max(100).optional().default(0),
          tax_percent: z.coerce.number().min(0).max(100).optional().default(18),
          description: z.string().optional().nullable(),
        })
      )
      .optional(),
  })
  .strict();

// ✅ Finalize Invoice
const finalizeSchema = z.object({
  regenerate_invoice_no: z.coerce.boolean().optional().default(false),
});

// ✅ Cancel Invoice
const cancelSchema = z.object({
  reason: z.string().min(3).max(255),
});

const markSentSchema = z.object({
  channel: z.enum(["EMAIL", "WHATSAPP", "OTHER"]).optional().default("OTHER"),
});

const reminderCreateSchema = z.object({
  reminder_date: z.string().min(8),
  channel: z.enum(["CALL", "WHATSAPP", "EMAIL", "OTHER"]).default("CALL"),
  note: z.string().max(500).optional().nullable(),
});

module.exports = {
  invoiceCreateSchema,
  invoiceUpdateSchema,
  finalizeSchema,
  cancelSchema,
  markSentSchema,
  reminderCreateSchema,
};
