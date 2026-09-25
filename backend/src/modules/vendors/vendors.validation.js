const { z } = require("zod");
const { partialUpdate } = require("../../utils/zodPartial");
const { gstinField } = require("../../utils/zodGst");

const vendorCreateSchema = z.object({
  name: z.string().min(2).max(120),
  phone: z.string().max(30).optional().nullable(),
  email: z.string().max(120).optional().nullable(),
  address: z.string().max(255).optional().nullable(),
  gstin: gstinField,
  is_active: z.number().int().optional().default(1),
});

const vendorUpdateSchema = partialUpdate(vendorCreateSchema);

const serviceCreateSchema = z.object({
  vendor_id: z.number().int().positive(),
  name: z.string().min(2).max(120),
  unit: z.string().min(1).max(20),
  rate: z.number().positive(),
  is_active: z.number().int().optional().default(1),
});

const serviceUpdateSchema = partialUpdate(serviceCreateSchema);

const consumptionCreateSchema = z.object({
  vendor_id: z.number().int().positive(),
  service_id: z.number().int().positive(),
  consume_date: z.string().min(10), // YYYY-MM-DD
  qty: z.number().positive(),
  notes: z.string().max(255).optional().nullable(),
});

const consumptionUpdateSchema = partialUpdate(consumptionCreateSchema);

const billGenerateSchema = z.object({
  vendor_id: z.number().int().positive(),
  bill_month: z.string().regex(/^\d{4}-\d{2}$/), // YYYY-MM
  from_date: z.string().min(10),
  to_date: z.string().min(10),
});

const billPaymentSchema = z.object({
  paid_date: z.string().min(10),
  amount: z.number().positive(),
  mode: z.enum(["CASH", "UPI", "BANK", "CARD", "OTHER"]).default("CASH"),
  reference_no: z.string().max(80).optional().nullable(),
  notes: z.string().max(255).optional().nullable(),
});

module.exports = {
  vendorCreateSchema,
  vendorUpdateSchema,
  serviceCreateSchema,
  serviceUpdateSchema,
  consumptionCreateSchema,
  consumptionUpdateSchema,
  billGenerateSchema,
  billPaymentSchema,
};
