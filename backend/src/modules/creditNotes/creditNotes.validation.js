const { z } = require("zod");

const creditNoteCreateSchema = z.object({
  cn_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date YYYY-MM-DD required"),
  reason: z.string().trim().min(3, "Reason required").max(255),
  lines: z
    .array(
      z.object({
        invoice_item_id: z.coerce.number().int().positive(),
        qty: z.coerce.number().min(0),
      })
    )
    .min(1, "At least 1 line required"),
  refund_amount: z.coerce.number().min(0).optional().default(0),
  refund_mode: z.enum(["CASH", "UPI", "BANK_TRANSFER", "CARD", "CHEQUE", "OTHER"]).optional().nullable(),
  refund_reference: z.string().max(120).optional().nullable(),
});

module.exports = { creditNoteCreateSchema };
