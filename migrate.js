require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const { Readable } = require('stream');

// ── Cloudinary Config ──
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ── MongoDB Connection ──
const MONGODB_URI = process.env.MONGODB_URI;
mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => { console.error('❌ MongoDB connection error:', err); process.exit(1); });

// ── Mongoose Schema ──
const projectSchema = new mongoose.Schema({
  title: String,
  category: String,
  description: String,
  image: String,
  createdAt: String,
});
const Project = mongoose.model('Project', projectSchema);

// ── Helper: Upload file to Cloudinary from local path ──
async function uploadToCloudinary(localPath) {
  // Remove leading slash if present
  const cleanPath = localPath.replace(/^\/+/, '');
  const fullPath = path.join(__dirname, 'uploads', cleanPath);
  if (!fs.existsSync(fullPath)) {
    console.warn(`⚠️ File not found: ${fullPath}`);
    return null;
  }
  try {
    const result = await cloudinary.uploader.upload(fullPath, {
      folder: 'portfolio-images',
      transformation: [{ width: 1200, height: 900, crop: 'limit' }],
    });
    return result.secure_url;
  } catch (error) {
    console.error(`❌ Upload failed for ${fullPath}:`, error.message);
    return null;
  }
}

// ── Migration ──
async function migrate() {
  const jsonPath = path.join(__dirname, 'data', 'projects.json');
  if (!fs.existsSync(jsonPath)) {
    console.error('❌ data/projects.json not found.');
    process.exit(1);
  }
  const oldProjects = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  console.log(`📄 Found ${oldProjects.length} projects in JSON.`);

  for (const p of oldProjects) {
    let cloudinaryUrl = null;
    if (p.image) {
      console.log(`📤 Uploading ${p.image} ...`);
      cloudinaryUrl = await uploadToCloudinary(p.image);
    }

    const newProject = new Project({
      title: p.title,
      category: p.category,
      description: p.description,
      image: cloudinaryUrl, // Cloudinary URL or null
      createdAt: p.createdAt || new Date().toISOString().split('T')[0],
    });
    await newProject.save();
    console.log(`✅ Migrated: ${p.title} → ${cloudinaryUrl || 'no image'}`);
  }

  console.log('🎉 Migration complete!');
  process.exit(0);
}

migrate();