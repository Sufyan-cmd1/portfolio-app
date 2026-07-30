require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ── Cloudinary ──
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'portfolio-images',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    transformation: [{ width: 1200, height: 900, crop: 'limit' }],
  },
});
const upload = multer({ storage });

// ── MongoDB ──
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// ── Mongoose Schema ──
const projectSchema = new mongoose.Schema({
  title: { type: String, required: true },
  category: { type: String, required: true },
  description: { type: String, required: true },
  image: { type: String, default: null },
  createdAt: { type: String, default: () => new Date().toISOString().split('T')[0] },
});
const Project = mongoose.model('Project', projectSchema);

// ── Admin Token ──
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'portfolio2005';

function adminAuth(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (token && token === ADMIN_TOKEN) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// ─── Routes ──────────────────────────────────────────

app.get('/api/projects', async (req, res) => {
  try {
    const projects = await Project.find().sort({ createdAt: -1 });
    res.json(projects);
  } catch {
    res.status(500).json({ error: 'Failed to load projects' });
  }
});

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_TOKEN) {
    res.json({ success: true, token: ADMIN_TOKEN });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

app.post('/api/projects', adminAuth, upload.single('image'), async (req, res) => {
  try {
    const newProject = new Project({
      title: req.body.title,
      category: req.body.category,
      description: req.body.description,
      image: req.file ? req.file.path : null,
    });
    await newProject.save();
    res.json(newProject);
  } catch (e) {
    res.status(500).json({ error: e.message || 'Create failed' });
  }
});

app.put('/api/projects/:id', adminAuth, upload.single('image'), async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    project.title = req.body.title || project.title;
    project.category = req.body.category || project.category;
    project.description = req.body.description || project.description;
    if (req.file) project.image = req.file.path;

    await project.save();
    res.json(project);
  } catch (e) {
    res.status(500).json({ error: e.message || 'Update failed' });
  }
});

app.delete('/api/projects/:id', adminAuth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    // Delete image from Cloudinary if exists
    if (project.image) {
      const publicId = project.image.split('/').pop().split('.')[0];
      await cloudinary.uploader.destroy(`portfolio-images/${publicId}`);
    }

    await Project.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Delete failed' });
  }
});

// ─── Contact ─────────────────────────────────────────

const emailUser = 'sufyanmalik7998@gmail.com';
const emailPass = process.env.EMAIL_PASS;

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: emailUser, pass: emailPass },
});

app.post('/api/contact', async (req, res) => {
  const { name, email, phone, message } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email, and message are required.' });
  }
  try {
    await transporter.sendMail({
      from: emailUser,
      to: 'sufyanmalik7998@gmail.com',
      subject: `New Contact from ${name}`,
      html: `<h2>New message</h2>
             <p><strong>Name:</strong> ${name}</p>
             <p><strong>Email:</strong> ${email}</p>
             <p><strong>Phone:</strong> ${phone || 'Not provided'}</p>
             <p><strong>Message:</strong><br>${message}</p>`,
    });
    res.json({ success: true, message: 'Email sent!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send email.' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Portfolio running on http://localhost:${PORT}`);
  console.log(`🔒 Admin password: ${ADMIN_TOKEN}`);
});
