import mongoose from 'mongoose';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, 'db.json');

// Check for MongoDB Connection URI
const MONGODB_URI = process.env.MONGODB_URI;
let isMongo = !!MONGODB_URI;

// --- MONGOOSE SCHEMAS & MODELS ---
const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, index: true },
  password: { type: String, default: '' },
  isPremium: { type: Boolean, default: false },
  subscriptionType: { type: String, default: 'free' },
  invitedMembers: { type: [String], default: [] },
  invitedBy: { type: String, default: null },
  isPendingRegistration: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const ProjectSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  userEmail: { type: String, required: true, index: true },
  name: { type: String, required: true },
  type: { type: String, required: true },
  atomCount: { type: Number, default: 0 },
  coordinates: { type: Array, default: [] },
  settings: { type: Object, default: {} },
  image: { type: String, default: null },
  updatedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

let User;
let Project;

if (isMongo) {
  User = mongoose.models.User || mongoose.model('User', UserSchema);
  Project = mongoose.models.Project || mongoose.model('Project', ProjectSchema);
}

// --- DATABASE SERVICE INTERFACE ---

export async function initDatabase() {
  if (isMongo) {
    try {
      await mongoose.connect(MONGODB_URI);
      console.log('Successfully connected to MongoDB cloud database.');
    } catch (err) {
      console.error('Failed to connect to MongoDB. Falling back to local JSON database.', err);
      isMongo = false;
      await initLocalDB();
    }
  } else {
    await initLocalDB();
  }
}

async function initLocalDB() {
  try {
    await fs.access(DB_FILE);
  } catch {
    await fs.writeFile(DB_FILE, JSON.stringify({ projects: [], users: {} }, null, 2), 'utf-8');
    console.log('Initialized local JSON database fallback at', DB_FILE);
  }
}

// Helper to read local DB file
async function readLocalDB() {
  try {
    const data = await fs.readFile(DB_FILE, 'utf-8');
    const db = JSON.parse(data);
    db.projects = db.projects || [];
    db.users = db.users || {};
    return db;
  } catch {
    return { projects: [], users: {} };
  }
}

// Helper to write local DB file
async function writeLocalDB(data) {
  await fs.writeFile(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// --- USER OPERATIONS ---

export async function getUser(email) {
  const cleanEmail = email.toLowerCase().trim();
  if (isMongo && mongoose.connection.readyState === 1) {
    const user = await User.findOne({ email: cleanEmail });
    if (!user) return null;
    return user.toObject();
  } else {
    const db = await readLocalDB();
    const user = db.users[cleanEmail];
    if (!user) return null;
    return { email: cleanEmail, ...user };
  }
}

export async function saveUser(email, userData) {
  const cleanEmail = email.toLowerCase().trim();
  if (isMongo && mongoose.connection.readyState === 1) {
    const updatedUser = await User.findOneAndUpdate(
      { email: cleanEmail },
      { $set: userData },
      { new: true, upsert: true }
    );
    return updatedUser.toObject();
  } else {
    const db = await readLocalDB();
    db.users[cleanEmail] = {
      ...(db.users[cleanEmail] || {}),
      ...userData
    };
    await writeLocalDB(db);
    return { email: cleanEmail, ...db.users[cleanEmail] };
  }
}

// Helper to fetch all emails in a user's active lab group
export async function getGroupEmails(email) {
  const cleanEmail = email.toLowerCase().trim();
  const user = await getUser(cleanEmail);
  if (!user) return [cleanEmail];

  if (user.subscriptionType === 'lab-group') {
    return [cleanEmail, ...(user.invitedMembers || [])];
  } else if (user.subscriptionType === 'invited' && user.invitedBy) {
    const ownerEmail = user.invitedBy.toLowerCase().trim();
    const owner = await getUser(ownerEmail);
    if (owner) {
      return [ownerEmail, ...(owner.invitedMembers || [])];
    }
  }

  return [cleanEmail];
}

// --- PROJECT OPERATIONS ---

export async function getProjectsForEmails(emails) {
  const cleanEmails = emails.map(e => e.toLowerCase().trim());
  if (isMongo && mongoose.connection.readyState === 1) {
    const projects = await Project.find({ userEmail: { $in: cleanEmails } }).sort({ updatedAt: -1 });
    return projects.map(p => p.toObject());
  } else {
    const db = await readLocalDB();
    return db.projects.filter(p => cleanEmails.includes(p.userEmail.toLowerCase().trim()));
  }
}

export async function getProjectById(id) {
  if (isMongo && mongoose.connection.readyState === 1) {
    const project = await Project.findOne({ id });
    return project ? project.toObject() : null;
  } else {
    const db = await readLocalDB();
    const project = db.projects.find(p => p.id === id);
    return project || null;
  }
}

export async function saveProject(projectData) {
  const now = new Date();
  if (isMongo && mongoose.connection.readyState === 1) {
    const existing = await Project.findOne({ id: projectData.id });
    if (existing) {
      // Update
      const updated = await Project.findOneAndUpdate(
        { id: projectData.id },
        { $set: { ...projectData, updatedAt: now } },
        { new: true }
      );
      return updated.toObject();
    } else {
      // Create
      const newProj = new Project({
        ...projectData,
        createdAt: now,
        updatedAt: now
      });
      await newProj.save();
      return newProj.toObject();
    }
  } else {
    const db = await readLocalDB();
    const existingIndex = db.projects.findIndex(p => p.id === projectData.id);
    const savedData = {
      ...projectData,
      updatedAt: now.toISOString()
    };
    
    if (existingIndex > -1) {
      savedData.createdAt = db.projects[existingIndex].createdAt;
      db.projects[existingIndex] = savedData;
    } else {
      savedData.createdAt = now.toISOString();
      db.projects.push(savedData);
    }
    await writeLocalDB(db);
    return savedData;
  }
}

export async function deleteProject(id) {
  if (isMongo && mongoose.connection.readyState === 1) {
    const res = await Project.deleteOne({ id });
    return res.deletedCount > 0;
  } else {
    const db = await readLocalDB();
    const index = db.projects.findIndex(p => p.id === id);
    if (index > -1) {
      db.projects.splice(index, 1);
      await writeLocalDB(db);
      return true;
    }
    return false;
  }
}
