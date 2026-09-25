const repo = require("./company.repository");

async function getCompany(companyId) {
  return repo.getById(companyId);
}

async function updateCompany(companyId, patch) {
  const affectedRows = await repo.updateById(companyId, patch);
  return affectedRows;
}

async function updateLogo(companyId, logoUrl) {
  return repo.setLogoUrl(companyId, logoUrl);
}

async function updateSignature(companyId, signatureUrl) {
  return repo.setSignatureUrl(companyId, signatureUrl);
}

module.exports = { getCompany, updateCompany, updateLogo, updateSignature };

