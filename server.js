const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(express.json());
app.use(express.static(__dirname));

const sessions = {};

function randId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function readData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    const initial = { users: [], chat: [], pastes: [], tickets: [], visitors: 0 };
    writeData(initial);
    return initial;
  }
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// --- AUTH MIDDLEWARE ---
function auth(req, res, next) {
  const token = req.headers.authorization;
  if (!token || !sessions[token]) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.username = sessions[token];
  next();
}

// --- SESSION ---
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing credentials' });
  const data = readData();
  const user = data.users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const token = crypto.randomBytes(32).toString('hex');
  sessions[token] = user.username;
  res.json({ token, user: { username: user.username, role: user.role } });
});

app.post('/api/auth/signup', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing credentials' });
  const data = readData();
  if (data.users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
    return res.status(409).json({ error: 'Username taken' });
  }
  const user = { username, password, role: 'regular' };
  data.users.push(user);
  writeData(data);
  res.json({ success: true });
});

app.get('/api/auth/session', auth, (req, res) => {
  const data = readData();
  const user = data.users.find(u => u.username.toLowerCase() === req.username.toLowerCase());
  if (!user) return res.status(401).json({ error: 'User not found' });
  res.json({ username: user.username, role: user.role });
});

app.post('/api/auth/logout', auth, (req, res) => {
  const token = Object.keys(sessions).find(k => sessions[k] === req.username);
  if (token) delete sessions[token];
  res.json({ success: true });
});

// --- USERS ---
app.get('/api/users', (req, res) => {
  const data = readData();
  const safe = data.users.map(u => ({ username: u.username, role: u.role, tagStyle: u.tagStyle, tagColor: u.tagColor, customTag: u.customTag }));
  res.json(safe);
});

app.put('/api/users/:username', auth, (req, res) => {
  const data = readData();
  const u = data.users.find(x => x.username.toLowerCase() === req.params.username.toLowerCase());
  if (!u) return res.status(404).json({ error: 'Not found' });
  const allowed = ['role', 'tagStyle', 'tagColor', 'customTag'];
  allowed.forEach(key => {
    if (req.body[key] !== undefined) u[key] = req.body[key];
  });
  writeData(data);
  res.json({ success: true });
});

app.delete('/api/users/:username', auth, (req, res) => {
  const data = readData();
  const idx = data.users.findIndex(x => x.username.toLowerCase() === req.params.username.toLowerCase());
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  data.users.splice(idx, 1);
  writeData(data);
  res.json({ success: true });
});

// --- CHAT ---
app.get('/api/chat', (req, res) => {
  const data = readData();
  res.json(data.chat || []);
});

app.post('/api/chat', auth, (req, res) => {
  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: 'Content required' });
  const data = readData();
  const msg = { id: randId(), author: req.username, content: content.trim(), time: Date.now() };
  data.chat.push(msg);
  writeData(data);
  res.json(msg);
});

app.delete('/api/chat/:id', auth, (req, res) => {
  const data = readData();
  data.chat = data.chat.filter(m => m.id !== req.params.id);
  writeData(data);
  res.json({ success: true });
});

// --- PASTES ---
app.get('/api/pastes', (req, res) => {
  const data = readData();
  res.json(data.pastes || []);
});

app.post('/api/pastes', auth, (req, res) => {
  const { title, content, anonymous } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: 'Content required' });
  const data = readData();
  const paste = {
    id: randId(),
    author: req.username,
    title: title || '',
    content: content.trim(),
    time: Date.now(),
    anonymous: !!anonymous,
    deleted: false,
    comments: [],
    views: 0
  };
  data.pastes.push(paste);
  writeData(data);
  res.json(paste);
});

app.get('/api/pastes/:id', (req, res) => {
  const data = readData();
  const paste = data.pastes.find(p => p.id === req.params.id);
  if (!paste) return res.status(404).json({ error: 'Not found' });
  paste.views = (paste.views || 0) + 1;
  writeData(data);
  res.json(paste);
});

app.put('/api/pastes/:id', auth, (req, res) => {
  const data = readData();
  const paste = data.pastes.find(p => p.id === req.params.id);
  if (!paste) return res.status(404).json({ error: 'Not found' });
  if (req.body.deleted !== undefined) paste.deleted = req.body.deleted;
  if (req.body.title !== undefined) paste.title = req.body.title;
  if (req.body.content !== undefined) paste.content = req.body.content;
  writeData(data);
  res.json(paste);
});

app.delete('/api/pastes/:id', auth, (req, res) => {
  const data = readData();
  data.pastes = data.pastes.filter(p => p.id !== req.params.id);
  writeData(data);
  res.json({ success: true });
});

// --- PASTE COMMENTS ---
app.post('/api/pastes/:id/comments', auth, (req, res) => {
  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: 'Content required' });
  const data = readData();
  const paste = data.pastes.find(p => p.id === req.params.id);
  if (!paste) return res.status(404).json({ error: 'Not found' });
  const comment = { id: randId(), author: req.username, content: content.trim(), time: Date.now(), deleted: false };
  if (!paste.comments) paste.comments = [];
  paste.comments.push(comment);
  writeData(data);
  res.json(comment);
});

app.put('/api/pastes/:id/comments/:cid', auth, (req, res) => {
  const data = readData();
  const paste = data.pastes.find(p => p.id === req.params.id);
  if (!paste) return res.status(404).json({ error: 'Not found' });
  const comment = (paste.comments || []).find(c => c.id === req.params.cid);
  if (!comment) return res.status(404).json({ error: 'Comment not found' });
  if (req.body.deleted !== undefined) comment.deleted = req.body.deleted;
  writeData(data);
  res.json(comment);
});

// --- TICKETS ---
app.get('/api/tickets', (req, res) => {
  const data = readData();
  res.json(data.tickets || []);
});

app.post('/api/tickets', auth, (req, res) => {
  const { subject, message, priority } = req.body;
  if (!subject || !message) return res.status(400).json({ error: 'Subject and message required' });
  const data = readData();
  const ticket = {
    id: Date.now(),
    subject: subject.trim(),
    message: message.trim(),
    author: req.username,
    date: new Date().toISOString(),
    status: 'open',
    priority: priority || 'low',
    replies: []
  };
  data.tickets.push(ticket);
  writeData(data);
  res.json(ticket);
});

app.put('/api/tickets/:id', auth, (req, res) => {
  const data = readData();
  const ticket = data.tickets.find(t => t.id === Number(req.params.id));
  if (!ticket) return res.status(404).json({ error: 'Not found' });
  if (req.body.status) ticket.status = req.body.status;
  writeData(data);
  res.json(ticket);
});

app.delete('/api/tickets/:id', auth, (req, res) => {
  const data = readData();
  data.tickets = data.tickets.filter(t => t.id !== Number(req.params.id));
  writeData(data);
  res.json({ success: true });
});

app.post('/api/tickets/:id/reply', auth, (req, res) => {
  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: 'Content required' });
  const data = readData();
  const ticket = data.tickets.find(t => t.id === Number(req.params.id));
  if (!ticket) return res.status(404).json({ error: 'Not found' });
  if (!ticket.replies) ticket.replies = [];
  ticket.replies.push({ author: req.username, content: content.trim(), date: new Date().toISOString() });
  writeData(data);
  res.json(ticket);
});

// --- VISITOR ---
app.get('/api/visitor', (req, res) => {
  const data = readData();
  data.visitors = (data.visitors || 0) + 1;
  writeData(data);
  res.json({ count: data.visitors });
});

app.listen(PORT, () => {
  console.log('Cybersec server running on http://localhost:' + PORT);
});
