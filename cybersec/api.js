/* Cybersec API helper — replaces localStorage with server calls */
var API_HOST = window.location.origin;
var API_TOKEN = localStorage.getItem('cybersec-token') || null;
var API_SESSION_CHECKED = false;

function apiHeaders() {
  var h = { 'Content-Type': 'application/json' };
  if (API_TOKEN) h['Authorization'] = API_TOKEN;
  return h;
}

function api(path, opts) {
  opts = opts || {};
  return fetch(API_HOST + '/api' + path, {
    method: opts.method || 'GET',
    headers: apiHeaders(),
    body: opts.body ? JSON.stringify(opts.body) : undefined
  }).then(function(r) {
    if (r.status === 401) {
      localStorage.removeItem('cybersec-token');
      localStorage.removeItem('cybersec-session');
      API_TOKEN = null;
      return r.json().then(function(d) { throw new Error(d.error || 'Unauthorized'); });
    }
    return r.json();
  });
}

// --- AUTH ---
function apiLogin(username, password) {
  return api('/auth/login', { method: 'POST', body: { username: username, password: password } }).then(function(d) {
    API_TOKEN = d.token;
    localStorage.setItem('cybersec-token', d.token);
    localStorage.setItem('cybersec-session', d.user.username);
    return d;
  });
}

function apiSignup(username, password) {
  return api('/auth/signup', { method: 'POST', body: { username: username, password: password } });
}

function apiLogout() {
  return api('/auth/logout', { method: 'POST' }).catch(function(){}).then(function() {
    localStorage.removeItem('cybersec-token');
    localStorage.removeItem('cybersec-session');
    API_TOKEN = null;
  });
}

function apiCheckSession() {
  if (!API_TOKEN) return Promise.resolve(null);
  return api('/auth/session').then(function(d) { return d; }).catch(function() { return null; });
}

// --- USERS ---
function apiGetUsers() {
  return api('/users');
}

function apiUpdateUser(username, data) {
  return api('/users/' + encodeURIComponent(username), { method: 'PUT', body: data });
}

function apiDeleteUser(username) {
  return api('/users/' + encodeURIComponent(username), { method: 'DELETE' });
}

// --- CHAT ---
function apiGetChat() {
  return api('/chat');
}

function apiPostChat(content) {
  return api('/chat', { method: 'POST', body: { content: content } });
}

function apiDeleteChat(id) {
  return api('/chat/' + id, { method: 'DELETE' });
}

// --- PASTES ---
function apiGetPastes() {
  return api('/pastes');
}

function apiCreatePaste(title, content, anonymous) {
  return api('/pastes', { method: 'POST', body: { title: title, content: content, anonymous: anonymous } });
}

function apiGetPaste(id) {
  return api('/pastes/' + id);
}

function apiUpdatePaste(id, data) {
  return api('/pastes/' + id, { method: 'PUT', body: data });
}

function apiDeletePaste(id) {
  return api('/pastes/' + id, { method: 'DELETE' });
}

function apiAddComment(pasteId, content) {
  return api('/pastes/' + pasteId + '/comments', { method: 'POST', body: { content: content } });
}

function apiDeleteComment(pasteId, commentId) {
  return api('/pastes/' + pasteId + '/comments/' + commentId, { method: 'PUT', body: { deleted: true } });
}

// --- TICKETS ---
function apiGetTickets() {
  return api('/tickets');
}

function apiCreateTicket(subject, message, priority) {
  return api('/tickets', { method: 'POST', body: { subject: subject, message: message, priority: priority } });
}

function apiUpdateTicket(id, data) {
  return api('/tickets/' + id, { method: 'PUT', body: data });
}

function apiDeleteTicket(id) {
  return api('/tickets/' + id, { method: 'DELETE' });
}

function apiReplyTicket(id, content) {
  return api('/tickets/' + id + '/reply', { method: 'POST', body: { content: content } });
}

// --- VISITOR ---
function apiGetVisitor() {
  return api('/visitor');
}
