const path = require("path");
const multer = require("multer");
const fs = require("fs");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function makeStorage(subFolder) {
  const dest = path.join(process.cwd(), "uploads", subFolder);
  ensureDir(dest);

  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, dest),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase();
      const safeExt = [".png", ".jpg", ".jpeg", ".webp"].includes(ext) ? ext : ".png";
      const name = `${subFolder}-${req.user.companyId}-${Date.now()}${safeExt}`;
      cb(null, name);
    },
  });
}

function imageOnly(req, file, cb) {
  const ok = ["image/png", "image/jpeg", "image/webp"].includes(file.mimetype);
  if (!ok) return cb(new Error("Only PNG/JPG/WEBP allowed"));
  cb(null, true);
}

const uploadLogo = multer({
  storage: makeStorage("logos"),
  fileFilter: imageOnly,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
});

const uploadSignature = multer({
  storage: makeStorage("signatures"),
  fileFilter: imageOnly,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
});

module.exports = { uploadLogo, uploadSignature };
