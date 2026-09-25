const { z } = require("zod");
const { partialUpdate } = require("../../utils/zodPartial");

const expenseCreateSchema = z.object({
  category_id: z.number().int().positive(),
  expense_date: z.string().min(10), // YYYY-MM-DD
  amount: z.number().positive(),
  payment_mode: z.enum(["CASH", "UPI", "BANK", "CARD", "OTHER"]).default("CASH"),
  vendor_name: z.string().max(120).optional().nullable(),
  reference_no: z.string().max(80).optional().nullable(),
  notes: z.string().max(255).optional().nullable(),
});

const expenseUpdateSchema = partialUpdate(expenseCreateSchema);

const categoryCreateSchema = z.object({
  name: z.string().min(2).max(80),
  is_active: z.number().int().optional().default(1),
});

const categoryUpdateSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  is_active: z.number().int().optional(),
});

module.exports = {
  expenseCreateSchema,
  expenseUpdateSchema,
  categoryCreateSchema,
  categoryUpdateSchema,
};
