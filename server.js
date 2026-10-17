const express = require('express');
const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = 3456;
const DB_PATH = path.join(__dirname, 'family_memo.db');
const CONFIG_PATH = path.join(__dirname, 'web', 'config', 'site.json');

app.use(express.json({ limit: '50mb' }));

let db = null;
let accessCode = null;

function isPrivateIp(ip) {
  if (!ip) return false;
  const addr = String(ip).replace(/^::ffff:/, '');
  if (addr === '::1' || addr === '127.0.0.1') return true;
  if (addr.startsWith('192.168.')) return true;
  if (addr.startsWith('10.')) return true;
  if (addr.startsWith('169.254.')) return true;
  const m = addr.match(/^172\.(\d{1,2})\./);
  if (m && +m[1] >= 16 && +m[1] <= 31) return true;
  if (/^f[cd][0-9a-f]{2}:/i.test(addr)) return true;
  if (/^fe[89ab][0-9a-f]:/i.test(addr)) return true;
  return false;
}

function computeToken() {
  return crypto.createHash('sha256').update(accessCode + ':family-memo-access').digest('hex');
}

// Serve config without exposing the access code to clients
app.get('/config/site.json', (req, res) => {
  const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  if (cfg.access) delete cfg.access.code;
  res.json(cfg);
});

app.use(express.static(path.join(__dirname, 'web')));

// Access control
app.get('/api/access/info', (req, res) => {
  const required = !!accessCode && !isPrivateIp(req.ip);
  const unlocked = !required || req.headers['x-access-token'] === computeToken();
  res.json({ required, unlocked });
});

app.post('/api/access/verify', (req, res) => {
  if (!accessCode) return res.json({ ok: true, token: '' });
  if (String((req.body && req.body.code) || '') === accessCode) {
    return res.json({ ok: true, token: computeToken() });
  }
  res.json({ ok: false });
});

app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/access')) return next();
  if (!accessCode || isPrivateIp(req.ip)) return next();
  if (req.headers['x-access-token'] === computeToken()) return next();
  res.status(401).json({ error: 'unauthorized' });
});

async function initDatabase() {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, icon TEXT NOT NULL,
      color TEXT NOT NULL, sort_order INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS memos (
      id INTEGER PRIMARY KEY, title TEXT NOT NULL, content TEXT DEFAULT '',
      category_id TEXT, date TEXT, amount REAL, priority INTEGER DEFAULT 0,
      done INTEGER DEFAULT 0, created_at TEXT NOT NULL, source TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY, memo_id INTEGER NOT NULL, data TEXT NOT NULL,
      thumbnail TEXT, type TEXT NOT NULL, name TEXT, ocr_text TEXT DEFAULT '',
      FOREIGN KEY (memo_id) REFERENCES memos(id) ON DELETE CASCADE
    );
  `);

  try { db.run('ALTER TABLE memos ADD COLUMN source TEXT DEFAULT \'\''); } catch (e) { /* column exists */ }

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  accessCode = config.access && config.access.code ? String(config.access.code) : null;
  const catCount = db.exec('SELECT COUNT(*) FROM categories');
  if (!catCount.length || catCount[0].values[0][0] === 0) {
    config.categories.forEach((cat, i) => {
      db.run('INSERT OR IGNORE INTO categories VALUES (?,?,?,?,?)',
        [cat.id, cat.name, cat.icon, cat.color, i]);
    });
  }
  saveDatabase();
}

function saveDatabase() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function query(sql, params = []) {
  const result = db.exec(sql, params);
  if (!result.length) return [];
  const columns = result[0].columns;
  return result[0].values.map(row => {
    const obj = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
}

function run(sql, params = []) {
  db.run(sql, params);
}

// Categories
app.get('/api/categories', (req, res) => {
  const rows = query('SELECT id, name, icon, color, sort_order FROM categories ORDER BY sort_order');
  res.json(rows);
});

app.post('/api/categories', (req, res) => {
  const { id, name, icon, color, sort_order } = req.body;
  run('INSERT INTO categories VALUES (?,?,?,?,?)', [id, name, icon, color, sort_order || 0]);
  saveDatabase();
  res.json({ ok: true });
});

app.put('/api/categories/:id', (req, res) => {
  const { name, icon, color } = req.body;
  run('UPDATE categories SET name=?, icon=?, color=? WHERE id=?', [name, icon, color, req.params.id]);
  saveDatabase();
  res.json({ ok: true });
});

app.delete('/api/categories/:id', (req, res) => {
  run('UPDATE memos SET category_id=NULL WHERE category_id=?', [req.params.id]);
  run('DELETE FROM categories WHERE id=?', [req.params.id]);
  saveDatabase();
  res.json({ ok: true });
});

// Memos
app.get('/api/memos', (req, res) => {
  const rows = query('SELECT id, title, content, category_id AS categoryId, date, amount, priority, done, created_at AS createdAt, source FROM memos ORDER BY created_at DESC');
  rows.forEach(r => { r.priority = !!r.priority; r.done = !!r.done; });
  res.json(rows);
});

app.post('/api/memos', (req, res) => {
  const m = req.body;
  run('INSERT INTO memos VALUES (?,?,?,?,?,?,?,?,?,?)',
    [m.id, m.title, m.content || '', m.categoryId, m.date, m.amount, m.priority ? 1 : 0, 0, m.createdAt, m.source || '']);
  saveDatabase();
  res.json({ ok: true });
});

app.put('/api/memos/:id', (req, res) => {
  const m = req.body;
  run('UPDATE memos SET title=?, content=?, category_id=?, date=?, amount=?, priority=? WHERE id=?',
    [m.title, m.content, m.categoryId, m.date, m.amount, m.priority ? 1 : 0, m.id]);
  saveDatabase();
  res.json({ ok: true });
});

app.patch('/api/memos/:id/toggle', (req, res) => {
  run('UPDATE memos SET done=? WHERE id=?', [req.body.done ? 1 : 0, req.params.id]);
  saveDatabase();
  res.json({ ok: true });
});

app.delete('/api/memos/:id', (req, res) => {
  run('DELETE FROM attachments WHERE memo_id=?', [req.params.id]);
  run('DELETE FROM memos WHERE id=?', [req.params.id]);
  saveDatabase();
  res.json({ ok: true });
});

// Attachments
app.get('/api/memos/:memoId/attachments', (req, res) => {
  const rows = query('SELECT id, thumbnail, type, name, ocr_text AS ocrText FROM attachments WHERE memo_id=?', [req.params.memoId]);
  res.json(rows);
});

app.get('/api/attachments/:attId/data', (req, res) => {
  const rows = query("SELECT data FROM attachments WHERE id=?", [req.params.attId]);
  res.json(rows.length ? rows[0].data : null);
});

app.post('/api/attachments', (req, res) => {
  const a = req.body;
  run('INSERT INTO attachments VALUES (?,?,?,?,?,?,?)',
    [a.id, a.memoId, a.data, a.thumbnail, a.type, a.name, a.ocrText || '']);
  saveDatabase();
  res.json({ ok: true });
});

app.delete('/api/attachments/:attId', (req, res) => {
  run('DELETE FROM attachments WHERE id=?', [req.params.attId]);
  saveDatabase();
  res.json({ ok: true });
});

app.delete('/api/memos/:memoId/attachments/:attId', (req, res) => {
  run('DELETE FROM attachments WHERE id=? AND memo_id=?', [req.params.attId, req.params.memoId]);
  saveDatabase();
  res.json({ ok: true });
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'web', 'index.html'));
});

initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Family Memo server running at http://localhost:${PORT}`);
    console.log(`Database: ${DB_PATH}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
