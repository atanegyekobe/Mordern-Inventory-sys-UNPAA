const path = require("path");
const multer = require("multer");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(process.cwd(), "uploads"));
  },
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/\s+/g, "-").toLowerCase();
    cb(null, `${Date.now()}-${safeName}`);
  },
});

const fileFilter = (req, file, cb) => {
  const isImage = file.mimetype.startsWith("image/");
  cb(isImage ? null : new Error("Only image uploads are allowed."), isImage);
};

// CSV upload config (memory storage for parsing)
const csvStorage = multer.memoryStorage();

const csvFileFilter = (req, file, cb) => {
  const isCsv = file.mimetype === "text/csv" || 
                file.originalname.toLowerCase().endsWith(".csv");
  cb(isCsv ? null : new Error("Only CSV files are allowed."), isCsv);
};

const uploadImage = multer({ storage, fileFilter });
const uploadCsv = multer({ 
  storage: csvStorage, 
  fileFilter: csvFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

module.exports = uploadImage;
module.exports.uploadCsv = uploadCsv;
