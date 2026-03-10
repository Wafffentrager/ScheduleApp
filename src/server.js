const http = require('http');
const path = require('path');
const fs = require('fs');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'schedule.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ lessons: [] }, null, 2));
  }
}

function readData() {
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  const cleaned = raw.replace(/^\uFEFF/, '').trim();
  if (!cleaned) {
    return { lessons: [] };
  }
  return JSON.parse(cleaned);
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function sendText(res, status, text) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e6) {
        req.destroy();
        reject(new Error('Body too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON'));
      }
    });
  });
}

function isValidDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isValidTime(value) {
  return /^\d{2}:\d{2}$/.test(value);
}

function validateLesson(input) {
  const required = ['date', 'start', 'end', 'subject'];
  for (const field of required) {
    if (!input[field] || String(input[field]).trim() === '') {
      return `Missing field: ${field}`;
    }
  }
  if (!isValidDate(input.date)) return 'Invalid date format (YYYY-MM-DD)';
  if (!isValidTime(input.start)) return 'Invalid start time (HH:MM)';
  if (!isValidTime(input.end)) return 'Invalid end time (HH:MM)';
  return null;
}

function sortLessons(lessons) {
  return lessons.slice().sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.start.localeCompare(b.start);
  });
}

function serveStatic(req, res) {
  const urlObj = new URL(req.url, `http://${req.headers.host}`);
  const requested = urlObj.pathname === '/' ? '/index.html' : urlObj.pathname;
  const filePath = path.join(PUBLIC_DIR, requested);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendText(res, 403, 'Forbidden');
    return;
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        sendText(res, 404, 'Not Found');
      } else {
        sendText(res, 500, 'Server Error');
      }
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const types = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.svg': 'image/svg+xml'
    };
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
    res.end(content);
  });
}

async function handleApi(req, res) {
  const urlObj = new URL(req.url, `http://${req.headers.host}`);
  const segments = urlObj.pathname.split('/').filter(Boolean);

  if (segments[0] !== 'api' || segments[1] !== 'lessons') {
    sendText(res, 404, 'Not Found');
    return;
  }

  if (req.method === 'GET' && segments.length === 2) {
    const data = readData();
    const lessons = sortLessons(data.lessons);
    sendJson(res, 200, { lessons });
    return;
  }

  if (req.method === 'POST' && segments.length === 2) {
    try {
      const body = await parseBody(req);
      const error = validateLesson(body);
      if (error) {
        sendJson(res, 400, { error });
        return;
      }

      const data = readData();
      const lesson = {
        id: String(Date.now()),
        date: body.date,
        start: body.start,
        end: body.end,
        subject: body.subject,
        teacher: body.teacher || '',
        room: body.room || '',
        group: body.group || ''
      };
      data.lessons.push(lesson);
      writeData(data);
      sendJson(res, 201, { lesson });
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  if (req.method === 'PUT' && segments.length === 3) {
    const id = segments[2];
    try {
      const body = await parseBody(req);
      const error = validateLesson(body);
      if (error) {
        sendJson(res, 400, { error });
        return;
      }

      const data = readData();
      const index = data.lessons.findIndex(item => item.id === id);
      if (index === -1) {
        sendJson(res, 404, { error: 'Lesson not found' });
        return;
      }

      data.lessons[index] = {
        ...data.lessons[index],
        date: body.date,
        start: body.start,
        end: body.end,
        subject: body.subject,
        teacher: body.teacher || '',
        room: body.room || '',
        group: body.group || ''
      };
      writeData(data);
      sendJson(res, 200, { lesson: data.lessons[index] });
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  sendText(res, 405, 'Method Not Allowed');
}

ensureDataFile();

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) {
    handleApi(req, res);
    return;
  }
  if (req.method !== 'GET') {
    sendText(res, 405, 'Method Not Allowed');
    return;
  }
  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`ScheduleApp running on http://localhost:${PORT}`);
});
