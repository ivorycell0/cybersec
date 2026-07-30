/* Netlify Function — proxies data.json to/from GitHub API */
const https = require('https');

const GH_OWNER = 'ivorycell0';
const GH_REPO = 'cybersec';
const GH_BRANCH = 'master';
const GH_PATH = 'data.json';
const GH_TOKEN = process.env.GH_TOKEN || '';

function ghRequest(method, sha, content) {
  return new Promise(function(resolve, reject) {
    var path = '/repos/' + GH_OWNER + '/' + GH_REPO + '/contents/' + GH_PATH;
    var body = null;
    if (method === 'PUT') {
      body = JSON.stringify({
        message: 'update data via Netlify',
        content: Buffer.from(content).toString('base64'),
        branch: GH_BRANCH,
        sha: sha || undefined
      });
    }
    var opts = {
      hostname: 'api.github.com',
      path: path,
      method: method,
      headers: {
        'User-Agent': 'netlify-function',
        'Accept': 'application/vnd.github.v3+json'
      }
    };
    if (GH_TOKEN) opts.headers['Authorization'] = 'token ' + GH_TOKEN;
    if (body) opts.headers['Content-Type'] = 'application/json';

    var req = https.request(opts, function(res) {
      var chunks = [];
      res.on('data', function(c) { chunks.push(c); });
      res.on('end', function() {
        var data = Buffer.concat(chunks).toString();
        try { resolve({ status: res.statusCode, json: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, text: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

exports.handler = async function(event) {
  var headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: headers, body: '' };
  }

  try {
    if (event.httpMethod === 'GET') {
      var result = await ghRequest('GET');
      if (result.status === 404) {
        var initial = { users: [], chat: [], pastes: [], tickets: [], visitors: 0 };
        return { statusCode: 200, headers: headers, body: JSON.stringify(initial) };
      }
      if (result.status !== 200) {
        return { statusCode: 500, headers: headers, body: JSON.stringify({ error: 'Failed to read data' }) };
      }
      var content = Buffer.from(result.json.content, 'base64').toString('utf-8');
      var sha = result.json.sha;
      var data = JSON.parse(content);
      return { statusCode: 200, headers: headers, body: JSON.stringify({ data: data, sha: sha }) };
    }

    if (event.httpMethod === 'POST') {
      var body = JSON.parse(event.body);
      var current = await ghRequest('GET');
      var sha = null;
      if (current.status === 200) sha = current.json.sha;
      var writeResult = await ghRequest('PUT', sha, JSON.stringify(body.data));
      if (writeResult.status === 409) {
        // Conflict — re-read and retry once
        var retryCurrent = await ghRequest('GET');
        if (retryCurrent.status === 200) sha = retryCurrent.json.sha;
        writeResult = await ghRequest('PUT', sha, JSON.stringify(body.data));
      }
      if (writeResult.status === 201 || writeResult.status === 200) {
        return { statusCode: 200, headers: headers, body: JSON.stringify({ ok: true }) };
      }
      return { statusCode: 500, headers: headers, body: JSON.stringify({ error: 'Write failed', detail: writeResult }) };
    }

    return { statusCode: 405, headers: headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (e) {
    return { statusCode: 500, headers: headers, body: JSON.stringify({ error: e.message }) };
  }
};
