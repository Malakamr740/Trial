import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);
const isProd = process.env.NODE_ENV === 'production';

// Ensure SQLite database directory exists
const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'database.sqlite');
const db = new DatabaseSync(dbPath);

// Initialize database schema - NO PROGRAM DATA SEEDING
// All tables start completely empty. Everything is saved and retrieved in database.
db.exec(`
  CREATE TABLE IF NOT EXISTS assessments (
    id TEXT PRIMARY KEY,
    title TEXT,
    subject TEXT,
    grade TEXT,
    data TEXT NOT NULL,
    created_at TEXT,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS questions (
    id TEXT PRIMARY KEY,
    subject TEXT,
    domain TEXT,
    topic TEXT,
    difficulty TEXT,
    data TEXT NOT NULL,
    created_at TEXT,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS collections (
    id TEXT PRIMARY KEY,
    name TEXT,
    data TEXT NOT NULL,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS curriculum_taxonomy (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS attempts (
    id TEXT PRIMARY KEY,
    assessment_id TEXT,
    student_name TEXT,
    student_email TEXT,
    status TEXT,
    data TEXT NOT NULL,
    report_data TEXT,
    created_at TEXT,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS report_templates (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS survey_questions (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS action_plans (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS survey_responses (
    id TEXT PRIMARY KEY,
    attempt_id TEXT,
    student_email TEXT,
    data TEXT NOT NULL,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    updated_at TEXT
  );
`);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// -----------------------------------------------------------------------------
// REST API: Assessments
// -----------------------------------------------------------------------------
app.get('/api/assessments', (_req: Request, res: Response) => {
  try {
    const rows = db.prepare('SELECT data FROM assessments ORDER BY updated_at DESC').all() as Array<{ data: string }>;
    const list = rows.map((r) => JSON.parse(r.data));
    res.json(list);
  } catch (err: any) {
    console.error('Error fetching assessments:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/assessments/:id', (req: Request, res: Response) => {
  try {
    const row = db.prepare('SELECT data FROM assessments WHERE id = ?').get(req.params.id) as { data: string } | undefined;
    if (!row) {
      return res.status(404).json({ error: 'Assessment not found' });
    }
    res.json(JSON.parse(row.data));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/assessments', (req: Request, res: Response) => {
  try {
    const assessment = req.body;
    if (!assessment || !assessment.id) {
      return res.status(400).json({ error: 'Invalid assessment data: id is required' });
    }
    const now = new Date().toISOString();
    const createdAt = assessment.createdAt || now;
    const updatedAt = assessment.updatedAt || now;

    const stmt = db.prepare(`
      INSERT INTO assessments (id, title, subject, grade, data, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        subject = excluded.subject,
        grade = excluded.grade,
        data = excluded.data,
        updated_at = excluded.updated_at
    `);

    stmt.run(
      assessment.id,
      assessment.title || '',
      assessment.subject || '',
      assessment.grade || '',
      JSON.stringify(assessment),
      createdAt,
      updatedAt
    );

    res.json({ success: true, assessment });
  } catch (err: any) {
    console.error('Error saving assessment:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/assessments/:id', (req: Request, res: Response) => {
  try {
    db.prepare('DELETE FROM assessments WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------------
// REST API: Questions
// -----------------------------------------------------------------------------
app.get('/api/questions', (_req: Request, res: Response) => {
  try {
    const rows = db.prepare('SELECT data FROM questions ORDER BY updated_at DESC').all() as Array<{ data: string }>;
    const list = rows.map((r) => JSON.parse(r.data));
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/questions/:id', (req: Request, res: Response) => {
  try {
    const row = db.prepare('SELECT data FROM questions WHERE id = ?').get(req.params.id) as { data: string } | undefined;
    if (!row) return res.status(404).json({ error: 'Question not found' });
    res.json(JSON.parse(row.data));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/questions', (req: Request, res: Response) => {
  try {
    const payload = req.body;
    const now = new Date().toISOString();
    const items = Array.isArray(payload) ? payload : [payload];

    const stmt = db.prepare(`
      INSERT INTO questions (id, subject, domain, topic, difficulty, data, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        subject = excluded.subject,
        domain = excluded.domain,
        topic = excluded.topic,
        difficulty = excluded.difficulty,
        data = excluded.data,
        updated_at = excluded.updated_at
    `);

    for (const q of items) {
      if (!q || !q.id) continue;
      stmt.run(
        q.id,
        q.subject || '',
        q.domain || '',
        q.topic || '',
        q.difficulty || '',
        JSON.stringify(q),
        q.createdAt || now,
        now
      );
    }

    res.json({ success: true, count: items.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/questions/:id', (req: Request, res: Response) => {
  try {
    db.prepare('DELETE FROM questions WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/questions/batch-delete', (req: Request, res: Response) => {
  try {
    const { ids } = req.body;
    if (Array.isArray(ids)) {
      const stmt = db.prepare('DELETE FROM questions WHERE id = ?');
      for (const id of ids) {
        stmt.run(id);
      }
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/questions', (_req: Request, res: Response) => {
  try {
    db.prepare('DELETE FROM questions').run();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------------
// REST API: Collections & Taxonomy
// -----------------------------------------------------------------------------
app.get('/api/collections', (_req: Request, res: Response) => {
  try {
    const rows = db.prepare('SELECT data FROM collections ORDER BY updated_at DESC').all() as Array<{ data: string }>;
    res.json(rows.map((r) => JSON.parse(r.data)));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/collections', (req: Request, res: Response) => {
  try {
    const payload = req.body;
    const items = Array.isArray(payload) ? payload : [payload];
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO collections (id, name, data, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        data = excluded.data,
        updated_at = excluded.updated_at
    `);

    for (const c of items) {
      if (!c || !c.name) continue;
      const colId = c.id || c.name;
      stmt.run(colId, c.name, JSON.stringify(c), now);
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/collections/:id', (req: Request, res: Response) => {
  try {
    db.prepare('DELETE FROM collections WHERE id = ? OR name = ?').run(req.params.id, req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/taxonomy', (_req: Request, res: Response) => {
  try {
    const row = db.prepare('SELECT data FROM curriculum_taxonomy WHERE id = ?').get('curriculum_taxonomy') as { data: string } | undefined;
    res.json(row ? JSON.parse(row.data) : null);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/taxonomy', (req: Request, res: Response) => {
  try {
    const data = req.body;
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO curriculum_taxonomy (id, data, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        data = excluded.data,
        updated_at = excluded.updated_at
    `);
    stmt.run('curriculum_taxonomy', JSON.stringify(data), now);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------------
// REST API: Assessment Attempts & Reports
// -----------------------------------------------------------------------------
app.get('/api/attempts', (req: Request, res: Response) => {
  try {
    const assessmentId = req.query.assessmentId as string | undefined;
    let rows: Array<{ data: string; report_data: string | null }>;

    if (assessmentId) {
      rows = db.prepare('SELECT data, report_data FROM attempts WHERE assessment_id = ? ORDER BY created_at DESC').all(assessmentId) as any;
    } else {
      rows = db.prepare('SELECT data, report_data FROM attempts ORDER BY created_at DESC').all() as any;
    }

    const list = rows.map((r) => {
      const parsed = JSON.parse(r.data);
      if (r.report_data && !parsed.report_data) {
        parsed.report_data = JSON.parse(r.report_data);
      }
      return parsed;
    });

    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/attempts/:id', (req: Request, res: Response) => {
  try {
    const row = db.prepare('SELECT data, report_data FROM attempts WHERE id = ?').get(req.params.id) as { data: string; report_data: string | null } | undefined;
    if (!row) {
      return res.status(404).json({ error: 'Attempt not found in database' });
    }
    const parsed = JSON.parse(row.data);
    if (row.report_data) {
      parsed.report_data = JSON.parse(row.report_data);
    }
    res.json(parsed);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/attempts', (req: Request, res: Response) => {
  try {
    const attempt = req.body;
    if (!attempt || !attempt.id) {
      return res.status(400).json({ error: 'Attempt id is required' });
    }

    const now = new Date().toISOString();
    const assessmentId = attempt.assessment_id || attempt.assessmentId || '';
    const studentName = attempt.student_name || attempt.studentName || '';
    const studentEmail = attempt.student_email || attempt.studentEmail || '';
    const status = attempt.status || 'in_progress';
    const reportDataStr = attempt.report_data ? JSON.stringify(attempt.report_data) : (attempt.fullReport ? JSON.stringify(attempt.fullReport) : null);

    const stmt = db.prepare(`
      INSERT INTO attempts (id, assessment_id, student_name, student_email, status, data, report_data, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        assessment_id = excluded.assessment_id,
        student_name = excluded.student_name,
        student_email = excluded.student_email,
        status = excluded.status,
        data = excluded.data,
        report_data = COALESCE(excluded.report_data, attempts.report_data),
        updated_at = excluded.updated_at
    `);

    stmt.run(
      attempt.id,
      assessmentId,
      studentName,
      studentEmail,
      status,
      JSON.stringify(attempt),
      reportDataStr,
      attempt.started_at || attempt.startedAt || now,
      now
    );

    res.json({ success: true, attempt });
  } catch (err: any) {
    console.error('Error saving attempt:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/attempts/:id', (req: Request, res: Response) => {
  try {
    db.prepare('DELETE FROM attempts WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------------
// REST API: Report Templates
// -----------------------------------------------------------------------------
app.get('/api/report-templates/:id?', (req: Request, res: Response) => {
  try {
    const id = req.params.id || 'global';
    const row = db.prepare('SELECT data FROM report_templates WHERE id = ?').get(id) as { data: string } | undefined;
    if (!row) {
      // If assessment specific template not found, return global template if available
      if (id !== 'global') {
        const globalRow = db.prepare('SELECT data FROM report_templates WHERE id = ?').get('global') as { data: string } | undefined;
        return res.json(globalRow ? JSON.parse(globalRow.data) : null);
      }
      return res.json(null);
    }
    res.json(JSON.parse(row.data));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/report-templates', (req: Request, res: Response) => {
  try {
    const { id, template } = req.body;
    const templateId = id || 'global';
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO report_templates (id, data, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        data = excluded.data,
        updated_at = excluded.updated_at
    `);

    stmt.run(templateId, JSON.stringify(template), now);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/report-templates/:id', (req: Request, res: Response) => {
  try {
    db.prepare('DELETE FROM report_templates WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------------
// REST API: Surveys
// -----------------------------------------------------------------------------
app.get('/api/surveys/questions', (_req: Request, res: Response) => {
  try {
    const rows = db.prepare('SELECT data FROM survey_questions ORDER BY updated_at ASC').all() as Array<{ data: string }>;
    res.json(rows.map((r) => JSON.parse(r.data)));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/surveys/questions', (req: Request, res: Response) => {
  try {
    const questions = req.body;
    const items = Array.isArray(questions) ? questions : [questions];
    const now = new Date().toISOString();

    db.prepare('DELETE FROM survey_questions').run();
    const stmt = db.prepare('INSERT INTO survey_questions (id, data, updated_at) VALUES (?, ?, ?)');
    for (const q of items) {
      if (!q || !q.id) continue;
      stmt.run(q.id, JSON.stringify(q), now);
    }
    res.json({ success: true, count: items.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/surveys/action-plans', (_req: Request, res: Response) => {
  try {
    const rows = db.prepare('SELECT data FROM action_plans ORDER BY updated_at ASC').all() as Array<{ data: string }>;
    res.json(rows.map((r) => JSON.parse(r.data)));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/surveys/action-plans', (req: Request, res: Response) => {
  try {
    const plans = req.body;
    const items = Array.isArray(plans) ? plans : [plans];
    const now = new Date().toISOString();

    db.prepare('DELETE FROM action_plans').run();
    const stmt = db.prepare('INSERT INTO action_plans (id, data, updated_at) VALUES (?, ?, ?)');
    for (const p of items) {
      if (!p || !p.id) continue;
      stmt.run(p.id, JSON.stringify(p), now);
    }
    res.json({ success: true, count: items.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/surveys/responses', (_req: Request, res: Response) => {
  try {
    const rows = db.prepare('SELECT data FROM survey_responses ORDER BY created_at DESC').all() as Array<{ data: string }>;
    res.json(rows.map((r) => JSON.parse(r.data)));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/surveys/responses', (req: Request, res: Response) => {
  try {
    const resp = req.body;
    const id = resp.id || `sr-${Date.now()}`;
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO survey_responses (id, attempt_id, student_email, data, created_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET data = excluded.data
    `);
    stmt.run(id, resp.attemptId || '', resp.studentEmail || '', JSON.stringify(resp), now);
    res.json({ success: true, id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------------
// REST API: App Settings (Organization, Registration Fields, Levels/Courses)
// -----------------------------------------------------------------------------
app.get('/api/settings/:key', (req: Request, res: Response) => {
  try {
    const row = db.prepare('SELECT data FROM app_settings WHERE key = ?').get(req.params.key) as { data: string } | undefined;
    res.json(row ? JSON.parse(row.data) : null);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/settings/:key', (req: Request, res: Response) => {
  try {
    const data = req.body;
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO app_settings (key, data, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        data = excluded.data,
        updated_at = excluded.updated_at
    `);
    stmt.run(req.params.key, JSON.stringify(data), now);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------------
// Dev & Production Middleware Setup
// -----------------------------------------------------------------------------
async function startServer() {
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Diagnostic Testing Platform running with SQLite database at http://0.0.0.0:${port}`);
  });
}

startServer();
