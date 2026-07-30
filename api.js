/* Cybersec API — calls Netlify Function which proxies to GitHub */
var API_BASE = '/api';
var _dataCache = null;
var _pendingSave = false;

function loadData() {
  if (_dataCache) return Promise.resolve(_dataCache);
  return fetch(API_BASE).then(function(r) {
    if (!r.ok) throw new Error('Failed to load');
    return r.json().then(function(d) {
      _dataCache = d.data || d;
      return _dataCache;
    });
  }).catch(function() {
    if (_dataCache) return _dataCache;
    var d = { users: [], chat: [], pastes: [], tickets: [], visitors: 0 };
    _dataCache = d;
    return d;
  });
}

function saveData() {
  if (_pendingSave) return;
  _pendingSave = true;
  fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: _dataCache })
  }).then(function(r) {
    _pendingSave = false;
  }).catch(function() {
    _pendingSave = false;
  });
}

function apiLogin(username, password) {
  return loadData().then(function(data) {
    data.users.forEach(function(u) { if (!u.role) u.role = 'regular'; });
    var cs = data.users.find(function(u) { return u.username.toLowerCase() === 'cs'; });
    if (cs) cs.role = 'owner';
    var found = data.users.find(function(u) { return u.username.toLowerCase() === username.toLowerCase() && u.password === password; });
    if (!found) throw new Error('Invalid credentials');
    localStorage.setItem('cybersec-session', found.username);
    return { user: { username: found.username, role: found.role } };
  });
}

function apiSignup(username, password) {
  return loadData().then(function(data) {
    if (data.users.find(function(u) { return u.username.toLowerCase() === username.toLowerCase(); })) {
      throw new Error('Username taken');
    }
    data.users.push({ username: username, password: password, role: 'regular' });
    saveData();
    return { success: true };
  });
}

function apiLogout() {
  localStorage.removeItem('cybersec-session');
  return Promise.resolve();
}

function apiGetUsers() {
  return loadData().then(function(data) {
    return data.users.map(function(u) { return { username: u.username, role: u.role, tagStyle: u.tagStyle, tagColor: u.tagColor, customTag: u.customTag }; });
  });
}

function apiUpdateUser(username, updates) {
  return loadData().then(function(data) {
    var u = data.users.find(function(x) { return x.username.toLowerCase() === username.toLowerCase(); });
    if (!u) throw new Error('User not found');
    var allowed = ['role', 'tagStyle', 'tagColor', 'customTag'];
    allowed.forEach(function(k) { if (updates[k] !== undefined) u[k] = updates[k]; });
    saveData();
  });
}

function apiDeleteUser(username) {
  return loadData().then(function(data) {
    data.users = data.users.filter(function(x) { return x.username.toLowerCase() !== username.toLowerCase(); });
    saveData();
  });
}

function apiGetChat() {
  return loadData().then(function(data) { return data.chat || []; });
}

function apiPostChat(content) {
  return loadData().then(function(data) {
    var msg = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), author: localStorage.getItem('cybersec-session'), content: content, time: Date.now() };
    data.chat.push(msg);
    saveData();
    return msg;
  });
}

function apiDeleteChat(id) {
  return loadData().then(function(data) {
    data.chat = data.chat.filter(function(m) { return m.id !== id; });
    saveData();
  });
}

function apiGetPastes() {
  return loadData().then(function(data) { return data.pastes || []; });
}

function apiCreatePaste(title, content, anonymous) {
  return loadData().then(function(data) {
    var paste = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), author: localStorage.getItem('cybersec-session'), title: title, content: content, time: Date.now(), anonymous: !!anonymous, deleted: false, comments: [], views: 0 };
    data.pastes.push(paste);
    saveData();
    return paste;
  });
}

function apiGetPaste(id) {
  return loadData().then(function(data) {
    var paste = data.pastes.find(function(p) { return p.id === id; });
    if (!paste) return null;
    paste.views = (paste.views || 0) + 1;
    saveData();
    return paste;
  });
}

function apiUpdatePaste(id, updates) {
  return loadData().then(function(data) {
    var paste = data.pastes.find(function(p) { return p.id === id; });
    if (!paste) throw new Error('Not found');
    if (updates.deleted !== undefined) paste.deleted = updates.deleted;
    if (updates.title !== undefined) paste.title = updates.title;
    if (updates.content !== undefined) paste.content = updates.content;
    if (updates.views !== undefined) paste.views = updates.views;
    saveData();
    return paste;
  });
}

function apiDeletePaste(id) {
  return loadData().then(function(data) {
    data.pastes = data.pastes.filter(function(p) { return p.id !== id; });
    saveData();
  });
}

function apiAddComment(pasteId, content) {
  return loadData().then(function(data) {
    var paste = data.pastes.find(function(p) { return p.id === pasteId; });
    if (!paste) throw new Error('Not found');
    if (!paste.comments) paste.comments = [];
    var comment = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), author: localStorage.getItem('cybersec-session'), content: content, time: Date.now(), deleted: false };
    paste.comments.push(comment);
    saveData();
    return comment;
  });
}

function apiDeleteComment(pasteId, commentId) {
  return loadData().then(function(data) {
    var paste = data.pastes.find(function(p) { return p.id === pasteId; });
    if (!paste) return;
    var comment = (paste.comments || []).find(function(c) { return c.id === commentId; });
    if (comment) comment.deleted = true;
    saveData();
  });
}

function apiGetTickets() {
  return loadData().then(function(data) { return data.tickets || []; });
}

function apiCreateTicket(subject, message, priority) {
  return loadData().then(function(data) {
    var ticket = { id: Date.now(), subject: subject, message: message, author: localStorage.getItem('cybersec-session'), date: new Date().toISOString(), status: 'open', priority: priority || 'low', replies: [] };
    data.tickets.push(ticket);
    saveData();
    return ticket;
  });
}

function apiUpdateTicket(id, updates) {
  return loadData().then(function(data) {
    var ticket = data.tickets.find(function(t) { return t.id === id; });
    if (!ticket) throw new Error('Not found');
    if (updates.status) ticket.status = updates.status;
    saveData();
    return ticket;
  });
}

function apiDeleteTicket(id) {
  return loadData().then(function(data) {
    data.tickets = data.tickets.filter(function(t) { return t.id !== id; });
    saveData();
  });
}

function apiReplyTicket(id, content) {
  return loadData().then(function(data) {
    var ticket = data.tickets.find(function(t) { return t.id === id; });
    if (!ticket) throw new Error('Not found');
    if (!ticket.replies) ticket.replies = [];
    ticket.replies.push({ author: localStorage.getItem('cybersec-session'), content: content, date: new Date().toISOString() });
    saveData();
    return ticket;
  });
}

function apiGetVisitor() {
  return loadData().then(function(data) {
    data.visitors = (data.visitors || 0) + 1;
    saveData();
    return { count: data.visitors };
  });
}
