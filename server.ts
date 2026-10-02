import express from 'express';
import type { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

const app = express();
// The dev server and backend proxy must always bind to port 3000.
// Cloud Run sets PORT=8080 which is occupied by the frontend reverse proxy (nginx).
const port = 3000;
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
    chapter TEXT,
    lesson TEXT,
    topic TEXT,
    difficulty TEXT,
    estimated_seconds INTEGER,
    target_exam TEXT,
    question_type TEXT,
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

// Run robust SQLite column migrations and backfill existing question records
function ensureQuestionsSchemaAndBackfill() {
  try {
    const tableInfo = db.prepare('PRAGMA table_info(questions)').all() as Array<{ name: string }>;
    const existingCols = new Set(tableInfo.map((c) => c.name));

    const columnsToAdd: Array<{ name: string; type: string; defaultVal: string }> = [
      { name: 'subject', type: 'TEXT', defaultVal: "'Mathematics'" },
      { name: 'domain', type: 'TEXT', defaultVal: "'Algebra & Functions'" },
      { name: 'chapter', type: 'TEXT', defaultVal: "'Linear Equations & Systems'" },
      { name: 'lesson', type: 'TEXT', defaultVal: "'Single-Variable Linear Equations'" },
      { name: 'topic', type: 'TEXT', defaultVal: "'Linear Equations & Systems'" },
      { name: 'difficulty', type: 'TEXT', defaultVal: "'medium'" },
      { name: 'estimated_seconds', type: 'INTEGER', defaultVal: '90' },
      { name: 'target_exam', type: 'TEXT', defaultVal: "'EST 1 / SAT Math'" },
      { name: 'question_type', type: 'TEXT', defaultVal: "'multiple_choice'" },
    ];

    for (const col of columnsToAdd) {
      if (!existingCols.has(col.name)) {
        console.log(`[Database Migration] Adding missing column '${col.name}' to 'questions' table`);
        db.exec(`ALTER TABLE questions ADD COLUMN ${col.name} ${col.type} DEFAULT ${col.defaultVal};`);
      }
    }

    // Backfill all existing rows to eliminate ANY nulls or blank fields in database columns and JSON blob
    const rows = db.prepare('SELECT id, data FROM questions').all() as Array<{ id: string; data: string }>;
    const updateStmt = db.prepare(`
      UPDATE questions
      SET
        subject = ?,
        domain = ?,
        chapter = ?,
        lesson = ?,
        topic = ?,
        difficulty = ?,
        estimated_seconds = ?,
        target_exam = ?,
        question_type = ?,
        data = ?,
        updated_at = ?
      WHERE id = ?
    `);

    let backfilledCount = 0;
    for (const row of rows) {
      if (!row.data) continue;
      try {
        const q = JSON.parse(row.data);
        const domain = (q.domain || 'Algebra & Functions').trim() || 'Algebra & Functions';
        const chapter = (q.chapter || q.topic || 'Linear Equations & Systems').trim() || 'Linear Equations & Systems';
        const lesson = (q.lesson || 'Single-Variable Linear Equations').trim() || 'Single-Variable Linear Equations';
        const topic = (q.topic || chapter).trim() || chapter;
        const subject = (q.subject || 'Mathematics').trim() || 'Mathematics';
        const difficulty = (q.difficulty || 'medium').trim() || 'medium';
        const estimatedSeconds = Math.max(10, Number(q.estimatedSeconds ?? q.estimated_seconds) || 90);
        const targetExam = (q.targetExam || q.target_exam || 'EST 1 / SAT Math').trim() || 'EST 1 / SAT Math';
        const questionType = (q.questionType || q.question_type || 'multiple_choice').trim() || 'multiple_choice';
        const now = new Date().toISOString();

        q.id = row.id;
        q.subject = subject;
        q.domain = domain;
        q.chapter = chapter;
        q.lesson = lesson;
        q.topic = topic;
        q.difficulty = difficulty;
        q.estimatedSeconds = estimatedSeconds;
        q.targetExam = targetExam;
        q.questionType = questionType;

        updateStmt.run(
          subject,
          domain,
          chapter,
          lesson,
          topic,
          difficulty,
          estimatedSeconds,
          targetExam,
          questionType,
          JSON.stringify(q),
          q.updatedAt || now,
          row.id
        );
        backfilledCount++;
      } catch (parseErr) {
        console.warn(`[Database Migration] Warning parsing row ${row.id}:`, parseErr);
      }
    }
    console.log(`[Database Migration] Questions table verified and ${backfilledCount} row(s) checked/backfilled with zero nulls.`);
  } catch (migErr) {
    console.error('[Database Migration] Error verifying questions schema:', migErr);
  }
}
ensureQuestionsSchemaAndBackfill();

// -----------------------------------------------------------------------------
// Database tables start empty - only user-saved data in database is returned
// -----------------------------------------------------------------------------
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
    const rows = db.prepare(`
      SELECT 
        id, subject, domain, chapter, lesson, topic, difficulty, 
        estimated_seconds, target_exam, question_type, data, created_at, updated_at 
      FROM questions 
      ORDER BY updated_at DESC
    `).all() as Array<any>;

    const list = rows.map((r) => {
      let parsed: any = {};
      try {
        parsed = JSON.parse(r.data);
      } catch {
        parsed = {};
      }
      return {
        ...parsed,
        id: r.id,
        subject: r.subject || parsed.subject || 'Mathematics',
        domain: r.domain || parsed.domain || 'Algebra & Functions',
        chapter: r.chapter || parsed.chapter || 'Linear Equations & Systems',
        lesson: r.lesson || parsed.lesson || 'Single-Variable Linear Equations',
        topic: r.topic || parsed.topic || r.chapter || 'Linear Equations & Systems',
        difficulty: r.difficulty || parsed.difficulty || 'medium',
        estimatedSeconds: r.estimated_seconds ?? parsed.estimatedSeconds ?? 90,
        targetExam: r.target_exam || parsed.targetExam || 'EST 1 / SAT Math',
        questionType: r.question_type || parsed.questionType || 'multiple_choice',
        createdAt: r.created_at || parsed.createdAt,
        updatedAt: r.updated_at || parsed.updatedAt,
      };
    });
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/questions/:id', (req: Request, res: Response) => {
  try {
    const row = db.prepare(`
      SELECT 
        id, subject, domain, chapter, lesson, topic, difficulty, 
        estimated_seconds, target_exam, question_type, data, created_at, updated_at 
      FROM questions 
      WHERE id = ?
    `).get(req.params.id) as any;

    if (!row) return res.status(404).json({ error: 'Question not found' });
    let parsed: any = {};
    try {
      parsed = JSON.parse(row.data);
    } catch {
      parsed = {};
    }
    const item = {
      ...parsed,
      id: row.id,
      subject: row.subject || parsed.subject || 'Mathematics',
      domain: row.domain || parsed.domain || 'Algebra & Functions',
      chapter: row.chapter || parsed.chapter || 'Linear Equations & Systems',
      lesson: row.lesson || parsed.lesson || 'Single-Variable Linear Equations',
      topic: row.topic || parsed.topic || row.chapter || 'Linear Equations & Systems',
      difficulty: row.difficulty || parsed.difficulty || 'medium',
      estimatedSeconds: row.estimated_seconds ?? parsed.estimatedSeconds ?? 90,
      targetExam: row.target_exam || parsed.targetExam || 'EST 1 / SAT Math',
      questionType: row.question_type || parsed.questionType || 'multiple_choice',
      createdAt: row.created_at || parsed.createdAt,
      updatedAt: row.updated_at || parsed.updatedAt,
    };
    res.json(item);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/questions', (req: Request, res: Response) => {
  try {
    const payload = req.body;
    const now = new Date().toISOString();
    const items = Array.isArray(payload) ? payload : [payload];

    if (items.length === 0) {
      return res.status(400).json({ error: 'No question data provided in request body' });
    }

    // MANDATORY VALIDATION:
    // Every question must be linked to domain, chapter, lesson, time estimate (estimatedSeconds >= 10), and prompt stem
    for (let i = 0; i < items.length; i++) {
      const q = items[i];
      if (!q || typeof q !== 'object') {
        return res.status(400).json({ error: `Question at index ${i} is invalid or empty.` });
      }

      const domain = (q.domain || '').trim();
      const chapter = (q.chapter || '').trim();
      const lesson = (q.lesson || '').trim();
      const prompt = (q.prompt || '').trim();
      const estSec = Number(q.estimatedSeconds ?? q.estimated_seconds);

      if (!domain) {
        return res.status(400).json({
          error: `Question ${q.id ? `"${q.id}"` : `#${i + 1}`} is missing mandatory 'domain'. Domain (Unit) is required.`,
        });
      }
      if (!chapter) {
        return res.status(400).json({
          error: `Question ${q.id ? `"${q.id}"` : `#${i + 1}`} is missing mandatory 'chapter'. Chapter is required.`,
        });
      }
      if (!lesson) {
        return res.status(400).json({
          error: `Question ${q.id ? `"${q.id}"` : `#${i + 1}`} is missing mandatory 'lesson'. Lesson is required.`,
        });
      }
      if (!prompt) {
        return res.status(400).json({
          error: `Question ${q.id ? `"${q.id}"` : `#${i + 1}`} is missing mandatory 'prompt' stem.`,
        });
      }
      if (isNaN(estSec) || estSec < 10) {
        return res.status(400).json({
          error: `Question ${q.id ? `"${q.id}"` : `#${i + 1}`} has invalid 'estimatedSeconds' (${q.estimatedSeconds}). Time estimate is mandatory and must be at least 10 seconds.`,
        });
      }
    }

    const stmt = db.prepare(`
      INSERT INTO questions (
        id, subject, domain, chapter, lesson, topic, difficulty, estimated_seconds, target_exam, question_type, data, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        subject = excluded.subject,
        domain = excluded.domain,
        chapter = excluded.chapter,
        lesson = excluded.lesson,
        topic = excluded.topic,
        difficulty = excluded.difficulty,
        estimated_seconds = excluded.estimated_seconds,
        target_exam = excluded.target_exam,
        question_type = excluded.question_type,
        data = excluded.data,
        updated_at = excluded.updated_at
    `);

    db.exec('BEGIN TRANSACTION');
    try {
      for (const q of items) {
        const qId = q.id || `qb-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        q.id = qId;

        const domain = q.domain.trim();
        const chapter = q.chapter.trim();
        const lesson = q.lesson.trim();
        const topic = (q.topic || chapter).trim();
        const subject = (q.subject || 'Mathematics').trim();
        const difficulty = (q.difficulty || 'medium').trim();
        const estSec = Math.max(10, Number(q.estimatedSeconds ?? q.estimated_seconds) || 90);
        const targetExam = (q.targetExam || q.target_exam || 'EST 1 / SAT Math').trim();
        const questionType = (q.questionType || q.question_type || 'multiple_choice').trim();

        // Keep JSON data strictly aligned with database columns
        q.domain = domain;
        q.chapter = chapter;
        q.lesson = lesson;
        q.topic = topic;
        q.subject = subject;
        q.difficulty = difficulty;
        q.estimatedSeconds = estSec;
        q.targetExam = targetExam;
        q.questionType = questionType;
        q.updatedAt = now;
        if (!q.createdAt) q.createdAt = now;

        stmt.run(
          qId,
          subject,
          domain,
          chapter,
          lesson,
          topic,
          difficulty,
          estSec,
          targetExam,
          questionType,
          JSON.stringify(q),
          q.createdAt || now,
          now
        );
      }
      db.exec('COMMIT');
    } catch (txErr) {
      db.exec('ROLLBACK');
      throw txErr;
    }

    console.log(`[Database] Successfully saved ${items.length} question(s) to SQLite database`);
    res.json({ success: true, count: items.length });
  } catch (err: any) {
    console.error('[Database] Error saving questions to SQLite:', err);
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
