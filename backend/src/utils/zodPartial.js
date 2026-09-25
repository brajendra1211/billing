/**
 * schema.partial() still applies .default() values, so a PATCH that only sends
 * { amount } would also reset e.g. cycle/is_active/payment_mode to their defaults.
 * This keeps only the keys the client actually sent.
 */
function partialUpdate(schema) {
  const partial = schema.partial();
  return {
    parse(input) {
      const out = partial.parse(input);
      const sent = input && typeof input === "object" ? input : {};
      for (const k of Object.keys(out)) {
        if (!Object.prototype.hasOwnProperty.call(sent, k)) delete out[k];
      }
      return out;
    },
  };
}

module.exports = { partialUpdate };
