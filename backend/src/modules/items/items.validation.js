const { z } = require("zod");
const { isValidHsn } = require("../../utils/gst");

const itemCreateSchema = z.object({
  type: z.enum(["PRODUCT", "SERVICE"]),
  name: z.string().min(1, "name is required"),
  sale_price: z.coerce.number().nonnegative().default(0),
  tax_percent: z.coerce.number().min(0).max(100).default(18),
  hsn_sac: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v === undefined ? undefined : v || null))
    .refine((v) => !v || isValidHsn(v), "HSN/SAC 4, 6 ya 8 digit ka number hona chahiye (jaise 998314)"),
  unit: z.string().optional().nullable().default("Nos"),
});

module.exports = { itemCreateSchema };
