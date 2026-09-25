const { z } = require("zod");

const paymentCreateSchema = z.object({
  payment_date: z.string().min(8), // YYYY-MM-DD
  amount: z.coerce.number().positive(),
  mode: z.enum(["CASH", "UPI", "BANK_TRANSFER", "CARD", "CHEQUE", "OTHER"]).default("UPI"),
  reference_no: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

module.exports = { paymentCreateSchema };
