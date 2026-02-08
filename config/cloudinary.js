// import { v2 as cloudinary } from "cloudinary";
// import fs from "fs";
// import dotenv from 'dotenv'
// dotenv.config();

// console.log("--- Checking Cloudinary Environment Variables ---");
// console.log("Cloud Name:", process.env.CLOUD_NAME);
// console.log("Cloud API Key:❤️❤️❤️❤️❤️❤️❤️❤️", process.env.CLOUD_API);
// console.log("Is Cloud Secret present?:", !!process.env.CLOUD_SECRET);

// cloudinary.config({
//   cloud_name: process.env.CLOUD_NAME,
//   api_key: process.env.CLOUD_API,
//   api_secret: process.env.CLOUD_SECRET,
// });

// export const uploadOnCloudinary = async (filePath) => {
//   try {
//     if (!filePath) return null;
//     const result = await cloudinary.uploader.upload(filePath, {
//       resource_type: "auto",
//     });
//     fs.unlinkSync(filePath);
//     return result;
//   } catch (error) {
//     if (filePath && fs.existsSync(filePath)) {
//       fs.unlinkSync(filePath);
//     }
//     console.error("Cloudinary upload failed:", error);
//     throw error;
//   }
// };
