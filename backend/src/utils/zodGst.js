const { z } = require("zod");
const { gstinError, stateCode, stateName } = require("./gst");

/** Optional GSTIN: trimmed, upper-cased, empty -> null, validated (format + check digit) */
const gstinField = z
  .string()
  .trim()
  .toUpperCase()
  .optional()
  .nullable()
  .transform((v) => (v === undefined ? undefined : v || null))
  .superRefine((v, ctx) => {
    const e = v ? gstinError(v) : null;
    if (e) ctx.addIssue({ code: "custom", message: e });
  });

/** Optional state: stored with its standard name when recognised ("up" -> "Uttar Pradesh") */
const stateField = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => {
    if (v === undefined) return undefined;
    if (!v) return null;
    const code = stateCode(v);
    return code ? stateName(code) : v;
  });

module.exports = { gstinField, stateField };
