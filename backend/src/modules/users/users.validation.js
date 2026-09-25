const { z } = require("zod");

const createUserSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email().max(120),
  password: z.string().min(6).max(100),
  role: z.enum(["ADMIN", "STAFF", "VIEWER"]).default("STAFF"),
});

const updateUserSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  email: z.string().email().max(120).optional(),
  role: z.enum(["ADMIN", "STAFF", "VIEWER"]).optional(),
});

const setActiveSchema = z.object({
  is_active: z.coerce.number().int().min(0).max(1),
});

const resetPasswordSchema = z.object({
  password: z.string().min(6).max(100),
});

module.exports = {
  createUserSchema,
  updateUserSchema,
  setActiveSchema,
  resetPasswordSchema,
};
