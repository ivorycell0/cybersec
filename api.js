/* Cybersec — pure localStorage, no server, no API */
var DATA_KEY = 'cybersec-data';

function getData() {
  var raw = localStorage.getItem(DATA_KEY);
  if (!raw) {
    var d = { users: [], chat: [], pastes: [], tickets: [], visitors: 0 };
    localStorage.setItem(DATA_KEY, JSON.stringify(d));
    return d;
  }
  return JSON.parse(raw);
}

function saveData(d) {
  localStorage.setItem(DATA_KEY, JSON.stringify(d));
}

function apiLogin(username, password) {
  return new Promise(function(resolve, reject) {
    var data = getData();
    data.users.forEach(function(u) { if (!u.role) u.role = 'regular'; });
    var cs = data.users.find(function(u) { return u.username.toLowerCase() === 'cs'; });
    if (cs) cs.role = 'owner';
    var found = data.users.find(function(u) { return u.username.toLowerCase() === username.toLowerCase() && u.password === password; });
    if (!found) return reject(new Error('Invalid credentials'));
    localStorage.setItem('cybersec-session', found.username);
    resolve({ user: { username: found.username, role: found.role } });
  });
}

function apiSignup(username, password) {
  return new Promise(function(resolve, reject) {
    var data = getData();
    if (data.users.find(function(u) { return u.username.toLowerCase() === username.toLowerCase(); })) {
      return reject(new Error('Username taken'));
    }
    data.users.push({ username: username, password: password, role: 'regular' });
    saveData(data);
    resolve({ success: true });
  });
}

function apiLogout() {
  localStorage.removeItem('cybersec-session');
  return Promise.resolve();
}

function apiGetUsers() {
  var data = getData();
  return Promise.resolve(data.users.map(function(u) { return { username: u.username, role: u.role, tagStyle: u.tagStyle, tagColor: u.tagColor, customTag: u.customTag }; }));
}

function apiUpdateUser(username, updates) {
  var data = getData();
  var u = data.users.find(function(x) { return x.username.toLowerCase() === username.toLowerCase(); });
  if (!u) return Promise.reject(new Error('User not found'));
  var allowed = ['role', 'tagStyle', 'tagColor', 'customTag'];
  allowed.forEach(function(k) { if (updates[k] !== undefined) u[k] = updates[k]; });
  saveData(data);
  return Promise.resolve();
}

function apiDeleteUser(username) {
  var data = getData();
  data.users = data.users.filter(function(x) { return x.username.toLowerCase() !== username.toLowerCase(); });
  saveData(data);
  return Promise.resolve();
}

function apiGetChat() {
  return Promise.resolve(getData().chat || []);
}

function apiPostChat(content) {
  var data = getData();
  var msg = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), author: localStorage.getItem('cybersec-session'), content: content, time: Date.now() };
  data.chat.push(msg);
  saveData(data);
  return Promise.resolve(msg);
}

function apiDeleteChat(id) {
  var data = getData();
  data.chat = data.chat.filter(function(m) { return m.id !== id; });
  saveData(data);
  return Promise.resolve();
}

function apiGetPastes() {
  return Promise.resolve(getData().pastes || []);
}

function apiCreatePaste(title, content, anonymous) {
  var data = getData();
  var paste = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), author: localStorage.getItem('cybersec-session'), title: title, content: content, time: Date.now(), anonymous: !!anonymous, deleted: false, comments: [], views: 0 };
  data.pastes.push(paste);
  saveData(data);
  return Promise.resolve(paste);
}

function apiGetPaste(id) {
  var data = getData();
  var paste = data.pastes.find(function(p) { return p.id === id; });
  if (!paste) return Promise.resolve(null);
  paste.views = (paste.views || 0) + 1;
  saveData(data);
  return Promise.resolve(paste);
}

function apiUpdatePaste(id, updates) {
  var data = getData();
  var paste = data.pastes.find(function(p) { return p.id === id; });
  if (!paste) return Promise.reject(new Error('Not found'));
  if (updates.deleted !== undefined) paste.deleted = updates.deleted;
  if (updates.title !== undefined) paste.title = updates.title;
  if (updates.content !== undefined) paste.content = updates.content;
  if (updates.views !== undefined) paste.views = updates.views;
  saveData(data);
  return Promise.resolve(paste);
}

function apiDeletePaste(id) {
  var data = getData();
  data.pastes = data.pastes.filter(function(p) { return p.id !== id; });
  saveData(data);
  return Promise.resolve();
}

function apiAddComment(pasteId, content) {
  var data = getData();
  var paste = data.pastes.find(function(p) { return p.id === pasteId; });
  if (!paste) return Promise.reject(new Error('Not found'));
  if (!paste.comments) paste.comments = [];
  var comment = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), author: localStorage.getItem('cybersec-session'), content: content, time: Date.now(), deleted: false };
  paste.comments.push(comment);
  saveData(data);
  return Promise.resolve(comment);
}

function apiDeleteComment(pasteId, commentId) {
  var data = getData();
  var paste = data.pastes.find(function(p) { return p.id === pasteId; });
  if (!paste) return Promise.resolve();
  var comment = (paste.comments || []).find(function(c) { return c.id === commentId; });
  if (comment) comment.deleted = true;
  saveData(data);
  return Promise.resolve();
}

function apiGetTickets() {
  return Promise.resolve(getData().tickets || []);
}

function apiCreateTicket(subject, message, priority) {
  var data = getData();
  var ticket = { id: Date.now(), subject: subject, message: message, author: localStorage.getItem('cybersec-session'), date: new Date().toISOString(), status: 'open', priority: priority || 'low', replies: [] };
  data.tickets.push(ticket);
  saveData(data);
  return Promise.resolve(ticket);
}

function apiUpdateTicket(id, updates) {
  var data = getData();
  var ticket = data.tickets.find(function(t) { return t.id === id; });
  if (!ticket) return Promise.reject(new Error('Not found'));
  if (updates.status) ticket.status = updates.status;
  saveData(data);
  return Promise.resolve(ticket);
}

function apiDeleteTicket(id) {
  var data = getData();
  data.tickets = data.tickets.filter(function(t) { return t.id !== id; });
  saveData(data);
  return Promise.resolve();
}

function apiReplyTicket(id, content) {
  var data = getData();
  var ticket = data.tickets.find(function(t) { return t.id === id; });
  if (!ticket) return Promise.reject(new Error('Not found'));
  if (!ticket.replies) ticket.replies = [];
  ticket.replies.push({ author: localStorage.getItem('cybersec-session'), content: content, date: new Date().toISOString() });
  saveData(data);
  return Promise.resolve(ticket);
}

function apiGetVisitor() {
  var data = getData();
  data.visitors = (data.visitors || 0) + 1;
  saveData(data);
  return Promise.resolve({ count: data.visitors });
}
