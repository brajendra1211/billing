const { z } = require("zod");
const { gstinField, stateField } = require("../../utils/zodGst");

const customerCreateSchema = z.object({
  name: z.string().min(1, "name is required"),
  contact_person: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  gstin: gstinField,

  billing_state: stateField,
  billing_city: z.string().optional().nullable(),
  billing_pincode: z.string().optional().nullable(),
  billing_address_line1: z.string().optional().nullable(),
});

module.exports = { customerCreateSchema };
