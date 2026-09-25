const { z } = require("zod");

const itemCreateSchema = z.object({
  type: z.enum(["PRODUCT", "SERVICE"]),
  name: z.string().min(1, "name is required"),
  sale_price: z.coerce.number().nonnegative().default(0),
  tax_percent: z.coerce.number().min(0).max(100).default(18),
  hsn_sac: z.string().optional().nullable(),
  unit: z.string().optional().nullable().default("Nos"),
});

module.exports = { itemCreateSchema };
