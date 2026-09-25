const bcrypt = require("bcrypt");
const repo = require("./users.repository");

async function list(companyId) {
  return repo.listUsers(companyId);
}

async function create(companyId, payload) {
  const exists = await repo.findByEmail(companyId, payload.email);
  if (exists) {
    const err = new Error("Email already exists");
    err.statusCode = 400;
    throw err;
  }

  const password_hash = await bcrypt.hash(payload.password, 10);
  const id = await repo.createUser({
    companyId,
    name: payload.name,
    email: payload.email,
    password_hash,
    role: payload.role,
  });
  return { id };
}

async function update(companyId, id, payload) {
  const current = await repo.getById(companyId, id);
  if (!current) {
    const err = new Error("User not found");
    err.statusCode = 404;
    throw err;
  }

  // email change uniqueness
  if (payload.email && payload.email !== current.email) {
    const exists = await repo.findByEmail(companyId, payload.email);
    if (exists) {
      const err = new Error("Email already exists");
      err.statusCode = 400;
      throw err;
    }
  }

  await repo.updateUser(companyId, id, payload);
  return { ok: true };
}

async function setActive(companyId, id, is_active) {
  const current = await repo.getById(companyId, id);
  if (!current) {
    const err = new Error("User not found");
    err.statusCode = 404;
    throw err;
  }
  await repo.setActive(companyId, id, is_active);
  return { ok: true };
}

async function resetPassword(companyId, id, password) {
  const current = await repo.getById(companyId, id);
  if (!current) {
    const err = new Error("User not found");
    err.statusCode = 404;
    throw err;
  }
  const password_hash = await bcrypt.hash(password, 10);
  await repo.resetPassword(companyId, id, password_hash);
  return { ok: true };
}

module.exports = { list, create, update, setActive, resetPassword };
