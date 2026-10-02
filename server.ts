import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { router as apiRouter } from './server/routes.ts';
import { db } from './server/db.ts';
import { analyzeFeedbackBatch, synthesizeRecurringIssues, fallbackAnalysis } from './server/gemini.ts';
import Papa from 'papaparse';
import type { FeedbackRecord } from './src/types.ts';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const isDev = process.env.npm_lifecycle_event === 'dev' || process.argv.includes('--dev');
const distPath = path.resolve(process.cwd(), 'dist');
const hasDist = fs.existsSync(path.resolve(distPath, 'index.html'));
const isProd = process.env.NODE_ENV === 'production' || (!isDev && hasDist);

// Body parsing with generous payload limit for CSV files
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Mount all API routes under /api
app.use('/api', apiRouter);

// Pre-seed reference dataset on first run if database has 0 feedback records
function seedInitialDataIfEmpty() {
  const existing = db.getAllFeedback();
  const hasNewSchema = existing.some((f) => f.feedback_id === 'FB-00275' || f.feedback_id === 'FB-00533');

  if (existing.length === 0 || !hasNewSchema) {
    const csvPath = path.resolve(process.cwd(), 'paynest_customer_feedback.csv');
    if (fs.existsSync(csvPath)) {
      try {
        const raw = fs.readFileSync(csvPath, 'utf-8');
        const parsed = Papa.parse(raw, { header: true, skipEmptyLines: true });
        const rows = parsed.data as any[];
        const records: FeedbackRecord[] = [];

        for (const r of rows) {
          if (!r.feedback_id || !r.raw_text) continue;
          records.push({
            feedback_id: String(r.feedback_id).trim(),
            customer_id: r.customer_id ? String(r.customer_id).trim() : undefined,
            customer_name: r.customer_name ? String(r.customer_name).trim() : undefined,
            email: r.email ? String(r.email).trim() : undefined,
            country: r.country ? String(r.country).trim() : 'Nigeria',
            city: r.city ? String(r.city).trim() : undefined,
            customer_segment: r.customer_segment ? String(r.customer_segment).trim() : 'Retail',
            plan_tier: r.plan_tier ? String(r.plan_tier).trim() : 'Basic',
            account_tenure_months:
              r.account_tenure_months !== undefined && r.account_tenure_months !== '' && !isNaN(Number(r.account_tenure_months))
                ? Number(r.account_tenure_months)
                : null,
            channel: r.channel ? String(r.channel).trim() : 'Customer Interview',
            source_reference: r.source_reference ? String(r.source_reference).trim() : undefined,
            submitted_at: r.submitted_at ? new Date(r.submitted_at).toISOString() : new Date().toISOString(),
            rating:
              r.rating !== undefined && r.rating !== null && r.rating !== '' && !isNaN(Number(r.rating))
                ? Number(r.rating)
                : null,
            nps_score:
              r.nps_score !== undefined && r.nps_score !== null && r.nps_score !== '' && !isNaN(Number(r.nps_score))
                ? Number(r.nps_score)
                : null,
            device: r.device ? String(r.device).trim() : undefined,
            os: r.os ? String(r.os).trim() : undefined,
            app_version: r.app_version ? String(r.app_version).trim() : undefined,
            raw_text: String(r.raw_text).trim(),
            created_at: new Date().toISOString(),
            source: 'csv',
          });
        }

        db.bulkImportFeedback(records, 'append');
        console.log(`[PayNext] Seeded ${records.length} initial reference feedback records from paynest_customer_feedback.csv`);
      } catch (err) {
        console.error('[PayNext] Failed to auto-seed reference CSV:', err);
      }
    }
  }

  ensureAllRecordsAnalyzed();
}

function ensureAllRecordsAnalyzed() {
  const all = db.getAllFeedback();
  console.log(`[PayNext] Running enhanced sentiment detection & categorization across ${all.length} records...`);
  const analyses = all.map((r) => fallbackAnalysis(r));
  db.bulkSaveAnalysis(analyses);

  const withAnalysis = all.map((r) => ({
    ...r,
    analysis: db.getAnalysisByFeedbackId(r.feedback_id),
  }));
  synthesizeRecurringIssues(withAnalysis).then((issues) => {
    db.setIssues(issues);
    console.log(`[PayNext] Successfully synthesized ${issues.length} recurring issues`);
  }).catch(err => console.error(err));
}

seedInitialDataIfEmpty();

// Vite integration
async function startServer() {
  if (isProd) {
    app.use(express.static(distPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'Endpoint not found' });
      }
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[PayNext] Server running on http://0.0.0.0:${PORT} (mode: ${isProd ? 'production' : 'development'})`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
});
