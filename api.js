/* Cybersec GitHub API — stores all data in repo's data.json */
var GH_OWNER = 'ivorycell0';
var GH_REPO = 'cybersec';
var GH_TOKEN = localStorage.getItem('gh-token') || '';
var GH_BRANCH = 'master';
var _dataCache = null;
var _dataSha = localStorage.getItem('gh-sha') || null;
var _pendingWrites = 0;

function ghApiUrl() {
  return 'https://api.github.com/repos/' + GH_OWNER + '/' + GH_REPO + '/contents/data.json';
}

function ghHeaders(method) {
  var h = { 'Accept': 'application/vnd.github.v3+json' };
  if (GH_TOKEN) h['Authorization'] = 'token ' + GH_TOKEN;
  if (method === 'PUT') h['Content-Type'] = 'application/json';
  return h;
}

function btoaUTF8(str) {
  var bytes = [];
  for (var i = 0; i < str.length; i++) {
    var c = str.charCodeAt(i);
    if (c < 128) bytes.push(c);
    else if (c < 2048) { bytes.push(192 | (c >> 6)); bytes.push(128 | (c & 63)); }
    else if (c < 65536) { bytes.push(224 | (c >> 12)); bytes.push(128 | ((c >> 6) & 63)); bytes.push(128 | (c & 63)); }
    else { bytes.push(240 | (c >> 18)); bytes.push(128 | ((c >> 12) & 63)); bytes.push(128 | ((c >> 6) & 63)); bytes.push(128 | (c & 63)); }
  }
  return btoa(String.fromCharCode.apply(null, bytes));
}

function atobUTF8(b64) {
  return decodeURIComponent(Array.prototype.map.call(atob(b64), function(c) {
    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
  }).join(''));
}

function readData() {
  return fetch(ghApiUrl(), { headers: ghHeaders() }).then(function(r) {
    if (r.status === 404) {
      var initial = { users: [], chat: [], pastes: [], tickets: [], visitors: 0 };
      return writeDataRaw(initial).then(function() { _dataCache = initial; return initial; });
    }
    return r.json().then(function(d) {
      _dataSha = d.sha;
      localStorage.setItem('gh-sha', _dataSha);
      _dataCache = JSON.parse(atobUTF8(d.content));
      return _dataCache;
    });
  }).catch(function() {
    if (_dataCache) return _dataCache;
    return { users: [], chat: [], pastes: [], tickets: [], visitors: 0 };
  });
}

function writeDataRaw(data) {
  var content = btoaUTF8(JSON.stringify(data));
  var body = { message: 'update', content: content, branch: GH_BRANCH };
  if (_dataSha) body.sha = _dataSha;
  return fetch(ghApiUrl(), {
    method: 'PUT',
    headers: ghHeaders('PUT'),
    body: JSON.stringify(body)
  }).then(function(r) {
    if (r.status === 409) {
      // Conflict — re-read and retry
      _dataSha = null;
      return readData().then(function() { return writeDataRaw(data); });
    }
    if (!r.ok) throw new Error('GitHub API error: ' + r.status);
    return r.json().then(function(d) {
      _dataSha = d.content.sha;
      localStorage.setItem('gh-sha', _dataSha);
    });
  });
}

function writeData() {
  if (_pendingWrites > 0) { _pendingWrites++; return; }
  _pendingWrites++;
  writeDataRaw(_dataCache).then(function() {
    _pendingWrites = 0;
    if (_pendingWrites > 0) { _pendingWrites = 0; writeData(); }
  }).catch(function() { _pendingWrites = 0; });
}

function ensureCache() {
  if (_dataCache) return Promise.resolve(_dataCache);
  return readData();
}

// --- AUTH ---
function apiLogin(username, password) {
  return ensureCache().then(function(data) {
    var users = data.users;
    users.forEach(function(u) { if (!u.role) u.role = 'regular'; });
    var cs = users.find(function(u) { return u.username.toLowerCase() === 'cs'; });
    if (cs) cs.role = 'owner';
    var found = users.find(function(u) { return u.username.toLowerCase() === username.toLowerCase() && u.password === password; });
    if (!found) throw new Error('Invalid credentials');
    localStorage.setItem('cybersec-session', found.username);
    return { user: { username: found.username, role: found.role } };
  });
}

function apiSignup(username, password) {
  return ensureCache().then(function(data) {
    if (data.users.find(function(u) { return u.username.toLowerCase() === username.toLowerCase(); })) {
      throw new Error('Username taken');
    }
    data.users.push({ username: username, password: password, role: 'regular' });
    writeData();
    return { success: true };
  });
}

function apiLogout() {
  localStorage.removeItem('cybersec-session');
  return Promise.resolve();
}

// --- USERS ---
function apiGetUsers() {
  return ensureCache().then(function(data) {
    return data.users.map(function(u) { return { username: u.username, role: u.role, tagStyle: u.tagStyle, tagColor: u.tagColor, customTag: u.customTag }; });
  });
}

function apiUpdateUser(username, updates) {
  return ensureCache().then(function(data) {
    var u = data.users.find(function(x) { return x.username.toLowerCase() === username.toLowerCase(); });
    if (!u) throw new Error('User not found');
    var allowed = ['role', 'tagStyle', 'tagColor', 'customTag'];
    allowed.forEach(function(k) { if (updates[k] !== undefined) u[k] = updates[k]; });
    writeData();
  });
}

function apiDeleteUser(username) {
  return ensureCache().then(function(data) {
    data.users = data.users.filter(function(x) { return x.username.toLowerCase() !== username.toLowerCase(); });
    writeData();
  });
}

// --- CHAT ---
function apiGetChat() {
  return ensureCache().then(function(data) { return data.chat || []; });
}

function apiPostChat(content) {
  return ensureCache().then(function(data) {
    var msg = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), author: localStorage.getItem('cybersec-session'), content: content, time: Date.now() };
    data.chat.push(msg);
    writeData();
    return msg;
  });
}

function apiDeleteChat(id) {
  return ensureCache().then(function(data) {
    data.chat = data.chat.filter(function(m) { return m.id !== id; });
    writeData();
  });
}

// --- PASTES ---
function apiGetPastes() {
  return ensureCache().then(function(data) { return data.pastes || []; });
}

function apiCreatePaste(title, content, anonymous) {
  return ensureCache().then(function(data) {
    var paste = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), author: localStorage.getItem('cybersec-session'), title: title, content: content, time: Date.now(), anonymous: !!anonymous, deleted: false, comments: [], views: 0 };
    data.pastes.push(paste);
    writeData();
    return paste;
  });
}

function apiGetPaste(id) {
  return ensureCache().then(function(data) {
    var paste = data.pastes.find(function(p) { return p.id === id; });
    if (!paste) return null;
    paste.views = (paste.views || 0) + 1;
    writeData();
    return paste;
  });
}

function apiUpdatePaste(id, updates) {
  return ensureCache().then(function(data) {
    var paste = data.pastes.find(function(p) { return p.id === id; });
    if (!paste) throw new Error('Not found');
    if (updates.deleted !== undefined) paste.deleted = updates.deleted;
    if (updates.title !== undefined) paste.title = updates.title;
    if (updates.content !== undefined) paste.content = updates.content;
    if (updates.views !== undefined) paste.views = updates.views;
    writeData();
    return paste;
  });
}

function apiDeletePaste(id) {
  return ensureCache().then(function(data) {
    data.pastes = data.pastes.filter(function(p) { return p.id !== id; });
    writeData();
  });
}

function apiAddComment(pasteId, content) {
  return ensureCache().then(function(data) {
    var paste = data.pastes.find(function(p) { return p.id === pasteId; });
    if (!paste) throw new Error('Not found');
    if (!paste.comments) paste.comments = [];
    var comment = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), author: localStorage.getItem('cybersec-session'), content: content, time: Date.now(), deleted: false };
    paste.comments.push(comment);
    writeData();
    return comment;
  });
}

function apiDeleteComment(pasteId, commentId) {
  return ensureCache().then(function(data) {
    var paste = data.pastes.find(function(p) { return p.id === pasteId; });
    if (!paste) return;
    var comment = (paste.comments || []).find(function(c) { return c.id === commentId; });
    if (comment) comment.deleted = true;
    writeData();
  });
}

// --- TICKETS ---
function apiGetTickets() {
  return ensureCache().then(function(data) { return data.tickets || []; });
}

function apiCreateTicket(subject, message, priority) {
  return ensureCache().then(function(data) {
    var ticket = { id: Date.now(), subject: subject, message: message, author: localStorage.getItem('cybersec-session'), date: new Date().toISOString(), status: 'open', priority: priority || 'low', replies: [] };
    data.tickets.push(ticket);
    writeData();
    return ticket;
  });
}

function apiUpdateTicket(id, updates) {
  return ensureCache().then(function(data) {
    var ticket = data.tickets.find(function(t) { return t.id === id; });
    if (!ticket) throw new Error('Not found');
    if (updates.status) ticket.status = updates.status;
    writeData();
    return ticket;
  });
}

function apiDeleteTicket(id) {
  return ensureCache().then(function(data) {
    data.tickets = data.tickets.filter(function(t) { return t.id !== id; });
    writeData();
  });
}

function apiReplyTicket(id, content) {
  return ensureCache().then(function(data) {
    var ticket = data.tickets.find(function(t) { return t.id === id; });
    if (!ticket) throw new Error('Not found');
    if (!ticket.replies) ticket.replies = [];
    ticket.replies.push({ author: localStorage.getItem('cybersec-session'), content: content, date: new Date().toISOString() });
    writeData();
    return ticket;
  });
}

function apiGetVisitor() {
  return ensureCache().then(function(data) {
    data.visitors = (data.visitors || 0) + 1;
    writeData();
    return { count: data.visitors };
  });
}
