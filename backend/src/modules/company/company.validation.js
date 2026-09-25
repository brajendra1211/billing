const { z } = require("zod");

const companyUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  legal_name: z.string().optional().nullable(),

  gstin: z.string().optional().nullable(),
  pan: z.string().optional().nullable(),

  billing_address_line1: z.string().optional().nullable(),
  billing_address_line2: z.string().optional().nullable(),
  billing_city: z.string().optional().nullable(),
  billing_state: z.string().optional().nullable(),
  billing_pincode: z.string().optional().nullable(),

  bank_name: z.string().optional().nullable(),
  bank_account_no: z.string().optional().nullable(),
  bank_ifsc: z.string().optional().nullable(),

  upi_id: z.string().optional().nullable(),
});

module.exports = { companyUpdateSchema };
