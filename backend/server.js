import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { 
  initDatabase, 
  getUser, 
  saveUser, 
  getGroupEmails, 
  getProjectsForEmails, 
  getProjectById, 
  saveProject, 
  deleteProject 
} from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Support base64 image uploads

// Initialize database
initDatabase();

// Auth Middleware
const authMiddleware = (req, res, next) => {
  const email = req.headers['x-user-email'];
  if (!email) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }
  req.userEmail = email.toLowerCase().trim();
  next();
};

// --- AUTHENTICATION ROUTES ---

// Login or register on-the-fly
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Gmail address is required.' });
    }
    const cleanEmail = email.toLowerCase().trim();

    let user = await getUser(cleanEmail);
    let isNew = false;

    if (!user) {
      // Register new user on-the-fly
      user = {
        isPremium: false,
        subscriptionType: 'free',
        invitedMembers: [],
        invitedBy: null,
        createdAt: new Date().toISOString()
      };
      user = await saveUser(cleanEmail, user);
      isNew = true;
    }

    if (user.isPremium && !user.subscriptionType) {
      user.subscriptionType = 'lab-group';
      user.invitedMembers = user.invitedMembers || [];
      user = await saveUser(cleanEmail, user);
    }

    res.json({
      user: {
        email: cleanEmail,
        isPremium: user.isPremium,
        subscriptionType: user.subscriptionType,
        invitedMembers: user.invitedMembers || [],
        invitedBy: user.invitedBy || null
      },
      isNew
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Authentication server error.' });
  }
});

// Upgrade to Premium (UPI checkout callback)
app.post('/api/subscribe', authMiddleware, async (req, res) => {
  try {
    const { plan } = req.body; // 'monthly', 'yearly', or 'group'
    const user = await getUser(req.userEmail);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    
    user.isPremium = true;
    if (plan === 'group') {
      user.subscriptionType = 'lab-group';
      user.invitedMembers = user.invitedMembers || [];
    } else if (plan === 'yearly') {
      user.subscriptionType = 'individual-yearly';
    } else {
      user.subscriptionType = 'individual-monthly';
    }

    const updatedUser = await saveUser(req.userEmail, user);
    res.json({
      message: 'Subscription successful!',
      user: {
        email: req.userEmail,
        isPremium: true,
        subscriptionType: updatedUser.subscriptionType,
        invitedMembers: updatedUser.invitedMembers || []
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Subscription processing failed.' });
  }
});

// Invite member to Lab Group
app.post('/api/subscription/add-member', authMiddleware, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }
    const cleanMember = email.toLowerCase().trim();
    
    const owner = await getUser(req.userEmail);
    if (!owner || owner.subscriptionType !== 'lab-group') {
      return res.status(403).json({ error: 'You do not have an active Lab Group subscription.' });
    }
    
    owner.invitedMembers = owner.invitedMembers || [];
    if (owner.invitedMembers.length >= 5) {
      return res.status(400).json({ error: 'You have reached the limit of 5 invited members.' });
    }
    if (owner.invitedMembers.includes(cleanMember)) {
      return res.status(400).json({ error: 'This email is already in your lab group.' });
    }
    if (cleanMember === req.userEmail) {
      return res.status(400).json({ error: 'You cannot invite yourself as a member.' });
    }
    
    owner.invitedMembers.push(cleanMember);
    await saveUser(req.userEmail, owner);
    
    // Update or create member record
    let memberUser = await getUser(cleanMember);
    if (memberUser) {
      memberUser.isPremium = true;
      memberUser.subscriptionType = 'invited';
      memberUser.invitedBy = req.userEmail;
      await saveUser(cleanMember, memberUser);
    } else {
      await saveUser(cleanMember, {
        isPremium: true,
        subscriptionType: 'invited',
        invitedBy: req.userEmail,
        createdAt: new Date().toISOString()
      });
    }
    
    res.json({
      message: 'Member added successfully!',
      user: {
        email: req.userEmail,
        isPremium: true,
        subscriptionType: owner.subscriptionType,
        invitedMembers: owner.invitedMembers
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to invite member.' });
  }
});

// Remove member from Lab Group
app.post('/api/subscription/remove-member', authMiddleware, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }
    const cleanMember = email.toLowerCase().trim();
    
    const owner = await getUser(req.userEmail);
    if (!owner || owner.subscriptionType !== 'lab-group') {
      return res.status(403).json({ error: 'You do not have an active Lab Group subscription.' });
    }
    
    owner.invitedMembers = owner.invitedMembers || [];
    const index = owner.invitedMembers.indexOf(cleanMember);
    if (index === -1) {
      return res.status(400).json({ error: 'Email not found in your lab group.' });
    }
    
    owner.invitedMembers.splice(index, 1);
    await saveUser(req.userEmail, owner);
    
    // Update member user record
    const memberUser = await getUser(cleanMember);
    if (memberUser && memberUser.invitedBy === req.userEmail) {
      memberUser.isPremium = false;
      memberUser.subscriptionType = 'free';
      delete memberUser.invitedBy;
      
      if (memberUser.isPendingRegistration) {
        memberUser.isPendingRegistration = false;
        await saveUser(cleanMember, memberUser);
      } else {
        await saveUser(cleanMember, memberUser);
      }
    }
    
    res.json({
      message: 'Member removed successfully!',
      user: {
        email: req.userEmail,
        isPremium: true,
        subscriptionType: owner.subscriptionType,
        invitedMembers: owner.invitedMembers
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to remove member.' });
  }
});

// --- PROJECT ROUTES (USER SCOPED / SHARED LAB WORKSPACE) ---

// 1. Get all projects (filtered by user group)
app.get('/api/projects', authMiddleware, async (req, res) => {
  try {
    const groupEmails = await getGroupEmails(req.userEmail);
    const userProjects = await getProjectsForEmails(groupEmails);
    const summary = userProjects.map(p => ({
      id: p.id,
      name: p.name,
      type: p.type, // '2d' or '3d'
      atomCount: p.atomCount,
      updatedAt: p.updatedAt,
      createdAt: p.createdAt,
      creator: p.userEmail
    }));
    res.json(summary);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to read projects database.' });
  }
});

// 2. Get specific project details
app.get('/api/projects/:id', authMiddleware, async (req, res) => {
  try {
    const project = await getProjectById(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }
    const groupEmails = await getGroupEmails(req.userEmail);
    if (!groupEmails.includes(project.userEmail)) {
      return res.status(403).json({ error: 'Unauthorized to view this project.' });
    }
    res.json(project);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to retrieve project details.' });
  }
});

// 3. Save or update a project
app.post('/api/projects', authMiddleware, async (req, res) => {
  try {
    const { id, name, type, atomCount, coordinates, settings, image } = req.body;
    if (!name || !type) {
      return res.status(400).json({ error: 'Project name and type are required.' });
    }

    const groupEmails = await getGroupEmails(req.userEmail);
    const projectId = id || Math.random().toString(36).substring(2, 11);
    
    // Check if updating existing project
    const existingProject = await getProjectById(projectId);
    if (existingProject) {
      if (!groupEmails.includes(existingProject.userEmail)) {
        return res.status(403).json({ error: 'Unauthorized to modify this project.' });
      }
    }

    const projectData = {
      id: projectId,
      userEmail: existingProject ? existingProject.userEmail : req.userEmail,
      name,
      type,
      atomCount: atomCount || (coordinates ? coordinates.length : 0),
      coordinates: coordinates || [],
      settings: settings || {},
      image: image || null
    };

    const saved = await saveProject(projectData);
    res.status(201).json(saved);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to save project.' });
  }
});

// 4. Delete a project
app.delete('/api/projects/:id', authMiddleware, async (req, res) => {
  try {
    const project = await getProjectById(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }
    const groupEmails = await getGroupEmails(req.userEmail);
    if (!groupEmails.includes(project.userEmail)) {
      return res.status(403).json({ error: 'Unauthorized to delete this project.' });
    }
    await deleteProject(req.params.id);
    res.json({ message: 'Project successfully deleted.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete project.' });
  }
});

// 5. Generate and download CSV of coordinates
app.post('/api/export/csv', (req, res) => {
  try {
    const { name, type, coordinates } = req.body;
    if (!coordinates || !Array.isArray(coordinates)) {
      return res.status(400).json({ error: 'Invalid or missing coordinates array.' });
    }

    let csvContent = '';
    if (type === '2d') {
      csvContent = 'ID,X (px),Y (px),Intensity,Element\n';
      coordinates.forEach(c => {
        csvContent += `${c.id || ''},${c.x.toFixed(2)},${c.y.toFixed(2)},${c.intensity ? c.intensity.toFixed(1) : ''},${c.element || 'Atom'}\n`;
      });
    } else {
      csvContent = 'ID,X (A),Y (A),Z (A),Element\n';
      coordinates.forEach(c => {
        csvContent += `${c.id || ''},${c.x.toFixed(4)},${c.y.toFixed(4)},${c.z.toFixed(4)},${c.element || 'C'}\n`;
      });
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${name || 'coordinates'}.csv"`);
    res.status(200).send(csvContent);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate CSV export.' });
  }
});

// 6. Generate and download standard XYZ molecular format
app.post('/api/export/xyz', (req, res) => {
  try {
    const { name, coordinates } = req.body;
    if (!coordinates || !Array.isArray(coordinates)) {
      return res.status(400).json({ error: 'Invalid or missing coordinates array.' });
    }

    // Standard XYZ format:
    // Line 1: Number of atoms
    // Line 2: Comment line (project name, details)
    // Line 3+: Element Symbol, X, Y, Z coordinates (in Angstroms)
    let xyzContent = `${coordinates.length}\n`;
    xyzContent += `Generated by Atom Analyzer Pro - Project: ${name || 'Structure'}\n`;
    
    coordinates.forEach(c => {
      const element = c.element || 'C';
      const x = c.x.toFixed(6).padStart(12);
      const y = c.y.toFixed(6).padStart(12);
      const z = c.z.toFixed(6).padStart(12);
      xyzContent += `${element.padEnd(4)}${x}${y}${z}\n`;
    });

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="${name || 'structure'}.xyz"`);
    res.status(200).send(xyzContent);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate XYZ export.' });
  }
});

// Serve static assets in production (Vite compilation output)
const distPath = path.join(__dirname, '../frontend/dist');
app.use(express.static(distPath));

// Catch-all route to serve the SPA index.html for react-router or frontend reload
app.get('*', (req, res, next) => {
  // If it is an API request, do not return the index.html (let Express return 404)
  if (req.path.startsWith('/api/')) {
    return next();
  }
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) {
      res.status(404).send('Frontend build not found. Please compile the frontend project first.');
    }
  });
});

app.listen(PORT, () => {
  console.log(`Atom Analyzer Backend running on port ${PORT}`);
});
