import dotenv from "dotenv";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import multerS3 from "multer-s3";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

// ----------------------------------------------
// Setup __dirname for ES modules
// ----------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ----------------------------------------------
// Load .env
// ----------------------------------------------
dotenv.config({ path: path.join(__dirname, "../.env") });



// ----------------------------------------------
// Validate critical environment variables
// ----------------------------------------------
if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
  throw new Error("❌ Missing AWS credentials in .env file");
}

if (!process.env.S3_BUCKET_NAME) {
  throw new Error("❌ Missing S3_BUCKET_NAME in .env file");
}

// ----------------------------------------------
// Initialize S3 Client
// ----------------------------------------------
export const s3 = new S3Client({
  region: process.env.AWS_REGION || "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID.trim(),
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY.trim(),
  },
});

// ----------------------------------------------
// Multer-S3 Storage
// ----------------------------------------------
const s3Storage = multerS3({
  s3,
  bucket: process.env.S3_BUCKET_NAME,
  metadata: (req, file, cb) => cb(null, { fieldName: file.fieldname }),
  key: (req, file, cb) => {
    const fileName = `${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 8)}${path.extname(file.originalname)}`;
    cb(null, `channels/${req.params.channelId || "general"}/images/${fileName}`);
  },
  contentType: multerS3.AUTO_CONTENT_TYPE,
});

// ----------------------------------------------
// File Filter
// ----------------------------------------------
const fileFilter = (req, file, cb) => {
  const allowed = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
  cb(null, allowed.includes(file.mimetype));
};

// ----------------------------------------------
// Upload Middleware
// ----------------------------------------------
export const uploadImage = multer({
  storage: s3Storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

// ----------------------------------------------
// Delete Function
// ----------------------------------------------
export const deleteFromS3 = async (key) => {
  if (!key) return;

  const command = new DeleteObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME,
    Key: key,
  });

  try {
    await s3.send(command);
    console.log(`🗑️ Deleted from S3: ${key}`);
  } catch (err) {
    console.error(`❌ Failed to delete S3 object ${key}:`, err);
    throw err;
  }
};
