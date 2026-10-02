import express, { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { db, verifyPassword, hashPassword } from './db.ts';
import {
  analyzeFeedbackBatch,
  synthesizeRecurringIssues,
  generateProductRequirement,
  fallbackAnalysis,
} from './gemini.ts';
import type {
  FeedbackRecord,
  GlobalFilterState,
  ImportValidationIssue,
  ImportJob,
} from '../src/types.ts';

export const router = Router();

// Default active admin user
const DEFAULT_ADMIN = {
  id: 'USR-ADMIN-1',
  email: 'admin@paynext.com',
  name: 'Tony Ogbuabor',
  role: 'superadmin' as const,
  created_at: '2026-09-30T10:00:00.000Z',
};

// --- Auth Middleware (Login restriction removed per user request) ---
function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = (req.headers['x-admin-token'] as string) || (req.query.token as string);
  const admin = token ? db.validateSession(token) : null;
  (req as any).admin = admin || db.getAdminById('USR-ADMIN-1') || DEFAULT_ADMIN;
  next();
}

// ==========================================
// 1. PUBLIC ROUTES (No Auth Required)
// ==========================================

router.get('/public/form-config', (req: Request, res: Response) => {
  const config = db.getFormConfig();
  res.json({
    title: config.title,
    description: config.description,
    accent_color: config.accent_color,
    enable_ratings: config.enable_ratings,
    enable_nps: config.enable_nps,
    enable_device_info: config.enable_device_info,
    enable_customer_name: config.enable_customer_name,
    enable_email: config.enable_email,
    custom_privacy_note: config.custom_privacy_note,
  });
});

router.post('/public/feedback', (req: Request, res: Response) => {
  try {
    const {
      customer_name,
      email,
      customer_id,
      customer_segment,
      plan_tier,
      account_tenure_months,
      country,
      city,
      raw_text,
      rating,
      nps_score,
      device,
      os,
      app_version,
    } = req.body;

    if (!raw_text || typeof raw_text !== 'string' || raw_text.trim().length < 5) {
      return res.status(400).json({ error: 'Customer feedback text is required (minimum 5 characters).' });
    }

    if (!country || typeof country !== 'string' || !country.trim()) {
      return res.status(400).json({ error: 'Country selection or entry is required.' });
    }

    let parsedRating: number | null = null;
    if (rating !== undefined && rating !== null && rating !== '') {
      const r = Number(rating);
      if (isNaN(r) || r < 1 || r > 5) {
        return res.status(400).json({ error: 'Rating must be a number between 1 and 5.' });
      }
      parsedRating = Math.round(r);
    }

    let parsedNps: number | null = null;
    if (nps_score !== undefined && nps_score !== null && nps_score !== '') {
      const n = Number(nps_score);
      if (isNaN(n) || n < 0 || n > 10) {
        return res.status(400).json({ error: 'Recommendation score (NPS) must be between 0 and 10.' });
      }
      parsedNps = Math.round(n);
    }

    let parsedTenure: number | null = null;
    if (account_tenure_months !== undefined && account_tenure_months !== null && account_tenure_months !== '') {
      const t = Number(account_tenure_months);
      if (!isNaN(t) && t >= 0) {
        parsedTenure = Math.round(t);
      }
    }

    const uniqueId = `FB-WEB-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;
    const custId = customer_id ? String(customer_id).trim() : `CUST-WEB-${Date.now().toString(36).toUpperCase().slice(-4)}`;

    const newRecord: FeedbackRecord = {
      feedback_id: uniqueId,
      customer_id: custId,
      customer_name: customer_name ? String(customer_name).trim() : 'Verified Customer',
      email: email ? String(email).trim() : undefined,
      country: String(country).trim(),
      city: city ? String(city).trim() : undefined,
      customer_segment: customer_segment ? String(customer_segment).trim() : 'Retail',
      plan_tier: plan_tier ? String(plan_tier).trim() : 'Standard',
      account_tenure_months: parsedTenure,
      channel: 'Web Feedback Form',
      source_reference: `WEB-${new Date().toISOString().substring(0, 10)}`,
      submitted_at: new Date().toISOString(),
      rating: parsedRating,
      nps_score: parsedNps,
      device: device ? String(device).trim() : undefined,
      os: os ? String(os).trim() : undefined,
      app_version: app_version ? String(app_version).trim() : 'Web Portal v2.4',
      raw_text: raw_text.trim(),
      created_at: new Date().toISOString(),
      source: 'web_form',
    };

    db.addFeedback(newRecord);
    db.incrementFormSubmissions();

    // Auto-analyze and categorize immediately
    try {
      const analysis = fallbackAnalysis(newRecord);
      db.saveAnalysis(analysis);
    } catch (e) {
      console.error('Error auto-analyzing public feedback:', e);
    }

    res.json({
      success: true,
      feedback_id: uniqueId,
      message: 'Feedback submitted successfully. Thank you for helping PayNext improve!',
    });
  } catch (err: any) {
    console.error('Error submitting feedback:', err);
    res.status(500).json({ error: 'Failed to process feedback submission.' });
  }
});

// ==========================================
// 2. AUTHENTICATION ROUTES
// ==========================================

router.post('/auth/login', (req: Request, res: Response) => {
  const admin = db.getAdminById('USR-ADMIN-1') || DEFAULT_ADMIN;
  const token = db.createSession(admin.id);
  res.json({
    token,
    user: admin,
  });
});

router.get('/auth/me', (req: Request, res: Response) => {
  const token = req.headers['x-admin-token'] as string;
  const admin = token ? db.validateSession(token) : null;
  res.json({ user: admin || db.getAdminById('USR-ADMIN-1') || DEFAULT_ADMIN });
});

router.post('/auth/logout', (_req: Request, res: Response) => {
  res.json({ success: true });
});

// ==========================================
// 3. ADMIN FEEDBACK EXPLORER
// ==========================================

router.get('/admin/feedback', authMiddleware, (req: Request, res: Response) => {
  try {
    const filters: GlobalFilterState = {
      dateRange: (req.query.dateRange as any) || 'all',
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      country: req.query.country as string,
      city: req.query.city as string,
      channel: req.query.channel as string,
      customerSegment: req.query.customerSegment as string,
      planTier: req.query.planTier as string,
      device: req.query.device as string,
      os: req.query.os as string,
      appVersion: req.query.appVersion as string,
      rating: req.query.rating ? Number(req.query.rating) : null,
      sentiment: req.query.sentiment as any,
      searchQuery: req.query.q as string,
    };

    const allRecords = db.getAllFeedback(filters);
    const analysisMap = db.getAnalysisMap();

    // Map each feedback with its analysis
    const combined = allRecords.map((f) => ({
      ...f,
      analysis: analysisMap.get(f.feedback_id) || null,
    }));

    // Pagination
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(5, Math.min(100, Number(req.query.limit) || 20));
    const total = combined.length;
    const startIndex = (page - 1) * limit;
    const paginated = combined.slice(startIndex, startIndex + limit);

    res.json({
      data: paginated,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err: any) {
    console.error('Error listing feedback:', err);
    res.status(500).json({ error: 'Failed to retrieve feedback records.' });
  }
});

router.get('/admin/feedback/:id', authMiddleware, (req: Request, res: Response) => {
  const feedback = db.getFeedbackById(req.params.id);
  if (!feedback) return res.status(404).json({ error: 'Feedback record not found.' });

  const analysis = db.getAnalysisByFeedbackId(feedback.feedback_id);
  const issues = db.getAllIssues().filter((i) => i.supporting_feedback_ids.includes(feedback.feedback_id));
  const requirements = db
    .getAllRequirements()
    .filter((r) => r.supporting_feedback_ids.includes(feedback.feedback_id));

  res.json({
    feedback,
    analysis,
    linked_issues: issues,
    linked_requirements: requirements,
  });
});

// ==========================================
// 4. CSV IMPORT & DATA MANAGEMENT
// ==========================================

function validateCsvRow(row: any, index: number, existingIds: Set<string>): ImportValidationIssue[] {
  const issues: ImportValidationIssue[] = [];

  const feedbackId = row.feedback_id || row.FeedbackId || row.feedbackId;
  const rawText = row.raw_text || row.feedback_text || row.comment || row.RawText;

  if (!feedbackId || !String(feedbackId).trim()) {
    issues.push({
      row: index + 1,
      field: 'feedback_id',
      message: 'Missing feedback_id.',
      severity: 'error',
    });
  } else if (existingIds.has(String(feedbackId).trim())) {
    issues.push({
      row: index + 1,
      field: 'feedback_id',
      feedback_id: String(feedbackId).trim(),
      message: `Duplicate feedback_id "${feedbackId}" detected.`,
      severity: 'warning',
    });
  }

  if (!rawText || !String(rawText).trim()) {
    issues.push({
      row: index + 1,
      field: 'raw_text',
      message: 'Missing customer feedback text (raw_text).',
      severity: 'error',
    });
  }

  const rating = row.rating || row.Rating;
  if (rating !== undefined && rating !== null && rating !== '') {
    const r = Number(rating);
    if (isNaN(r) || r < 1 || r > 5) {
      issues.push({
        row: index + 1,
        field: 'rating',
        message: `Invalid rating: "${rating}". Expected 1 to 5.`,
        severity: 'warning',
      });
    }
  }

  const nps = row.nps_score || row.nps || row.NpsScore;
  if (nps !== undefined && nps !== null && nps !== '') {
    const n = Number(nps);
    if (isNaN(n) || n < 0 || n > 10) {
      issues.push({
        row: index + 1,
        field: 'nps_score',
        message: `Invalid NPS score: "${nps}". Expected 0 to 10.`,
        severity: 'warning',
      });
    }
  }

  return issues;
}

router.post('/admin/import/preview', authMiddleware, (req: Request, res: Response) => {
  try {
    const { csvData } = req.body;
    if (!csvData) {
      return res.status(400).json({ error: 'No CSV data provided.' });
    }

    const parsed = Papa.parse(csvData, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
    });

    if (parsed.errors && parsed.errors.length > 0) {
      console.warn('PapaParse preview warnings:', parsed.errors);
    }

    const headers = parsed.meta.fields || [];
    const rows = parsed.data as any[];

    const existingFeedback = db.getAllFeedback();
    const existingIds = new Set(existingFeedback.map((f) => f.feedback_id));

    const validationIssues: ImportValidationIssue[] = [];
    const seenInCsv = new Set<string>();

    rows.forEach((row, i) => {
      const rowIssues = validateCsvRow(row, i, existingIds);
      const fId = row.feedback_id || row.FeedbackId;
      if (fId) {
        if (seenInCsv.has(fId)) {
          rowIssues.push({
            row: i + 1,
            field: 'feedback_id',
            feedback_id: fId,
            message: `Duplicate feedback_id "${fId}" found inside this CSV file.`,
            severity: 'error',
          });
        } else {
          seenInCsv.add(fId);
        }
      }
      validationIssues.push(...rowIssues);
    });

    const errorCount = validationIssues.filter((v) => v.severity === 'error').length;
    const warningCount = validationIssues.filter((v) => v.severity === 'warning').length;

    res.json({
      headers,
      totalRows: rows.length,
      sampleRows: rows.slice(0, 10),
      validationSummary: {
        errorCount,
        warningCount,
        validRowsEstimate: rows.length - errorCount,
        issues: validationIssues.slice(0, 50),
      },
    });
  } catch (err: any) {
    console.error('Error previewing CSV:', err);
    res.status(500).json({ error: 'Failed to parse CSV preview.' });
  }
});

router.post('/admin/import/process', authMiddleware, (req: Request, res: Response) => {
  try {
    const { csvData, mode = 'append', columnMapping = {} } = req.body;
    if (!csvData) {
      return res.status(400).json({ error: 'No CSV data provided for import.' });
    }

    const parsed = Papa.parse(csvData, {
      header: true,
      skipEmptyLines: true,
    });

    const rows = parsed.data as any[];
    const existingFeedback = mode === 'replace' ? [] : db.getAllFeedback();
    const existingIds = new Set(existingFeedback.map((f) => f.feedback_id));

    const validRecords: FeedbackRecord[] = [];
    const validationIssues: ImportValidationIssue[] = [];
    let skippedCount = 0;
    let rejectedCount = 0;

    rows.forEach((row, idx) => {
      // Map columns if custom mapping provided
      const getVal = (stdKey: string) => {
        const mapped = columnMapping[stdKey] || stdKey;
        return row[mapped] !== undefined ? row[mapped] : row[stdKey];
      };

      const rawFid = getVal('feedback_id');
      const rawText = getVal('raw_text');

      if (!rawFid || !String(rawFid).trim() || !rawText || !String(rawText).trim()) {
        rejectedCount++;
        validationIssues.push({
          row: idx + 1,
          field: 'required_fields',
          message: 'Skipped row due to missing feedback_id or raw_text.',
          severity: 'error',
        });
        return;
      }

      const fId = String(rawFid).trim();

      if (existingIds.has(fId)) {
        skippedCount++;
        validationIssues.push({
          row: idx + 1,
          field: 'feedback_id',
          feedback_id: fId,
          message: `Skipped existing feedback_id ${fId}`,
          severity: 'warning',
        });
        return;
      }

      let parsedRating: number | null = null;
      const rVal = getVal('rating');
      if (rVal !== undefined && rVal !== null && rVal !== '') {
        const num = Number(rVal);
        if (!isNaN(num) && num >= 1 && num <= 5) parsedRating = Math.round(num);
      }

      let parsedNps: number | null = null;
      const nVal = getVal('nps_score');
      if (nVal !== undefined && nVal !== null && nVal !== '') {
        const num = Number(nVal);
        if (!isNaN(num) && num >= 0 && num <= 10) parsedNps = Math.round(num);
      }

      let tenure: number | null = null;
      const tVal = getVal('account_tenure_months');
      if (tVal !== undefined && tVal !== null && tVal !== '') {
        const num = Number(tVal);
        if (!isNaN(num)) tenure = Math.round(num);
      }

      const record: FeedbackRecord = {
        feedback_id: fId,
        customer_id: getVal('customer_id') ? String(getVal('customer_id')).trim() : undefined,
        customer_name: getVal('customer_name') ? String(getVal('customer_name')).trim() : undefined,
        email: getVal('email') ? String(getVal('email')).trim() : undefined,
        country: getVal('country') ? String(getVal('country')).trim() : 'Unknown',
        city: getVal('city') ? String(getVal('city')).trim() : undefined,
        customer_segment: getVal('customer_segment') ? String(getVal('customer_segment')).trim() : 'Unspecified',
        plan_tier: getVal('plan_tier') ? String(getVal('plan_tier')).trim() : 'Standard',
        account_tenure_months: tenure,
        channel: getVal('channel') ? String(getVal('channel')).trim() : 'CSV Import',
        source_reference: getVal('source_reference') ? String(getVal('source_reference')).trim() : undefined,
        submitted_at: getVal('submitted_at') ? new Date(getVal('submitted_at')).toISOString() : new Date().toISOString(),
        rating: parsedRating,
        nps_score: parsedNps,
        device: getVal('device') ? String(getVal('device')).trim() : undefined,
        os: getVal('os') ? String(getVal('os')).trim() : undefined,
        app_version: getVal('app_version') ? String(getVal('app_version')).trim() : undefined,
        raw_text: String(rawText).trim(),
        created_at: new Date().toISOString(),
        source: 'csv',
      };

      existingIds.add(fId);
      validRecords.push(record);
    });

    const result = db.bulkImportFeedback(validRecords, mode);

    // Auto-analyze all newly imported records immediately to detect negative complaints and categories
    let negativeCount = 0;
    let positiveCount = 0;
    let neutralCount = 0;
    try {
      const analyses = validRecords.map((r) => fallbackAnalysis(r));
      db.bulkSaveAnalysis(analyses);

      for (const a of analyses) {
        if (a.sentiment === 'Negative') negativeCount++;
        else if (a.sentiment === 'Positive') positiveCount++;
        else neutralCount++;
      }

      // Re-synthesize recurring issues with the new data
      const allFeedbackWithAnalysis = db.getAllFeedback().map((f) => ({
        ...f,
        analysis: db.getAnalysisByFeedbackId(f.feedback_id),
      }));
      synthesizeRecurringIssues(allFeedbackWithAnalysis).then((issues) => {
        db.setIssues(issues);
      }).catch((e) => console.error('Error synthesizing issues after import:', e));
    } catch (e) {
      console.error('Error auto-analyzing imported records:', e);
    }

    const job: ImportJob = {
      id: `JOB-${Date.now().toString(36).toUpperCase()}`,
      filename: req.body.filename || 'uploaded_customer_feedback.csv',
      imported_at: new Date().toISOString(),
      total_rows: rows.length,
      imported_count: result.imported,
      skipped_count: skippedCount + result.skipped,
      rejected_count: rejectedCount,
      validation_issues: validationIssues.slice(0, 100),
    };
    db.addImportJob(job);

    res.json({
      success: true,
      job,
      summary: {
        totalRows: rows.length,
        imported: result.imported,
        skipped: skippedCount + result.skipped,
        rejected: rejectedCount,
        replaced: result.replaced,
        negativeCount,
        positiveCount,
        neutralCount,
      },
    });
  } catch (err: any) {
    console.error('Error importing CSV:', err);
    res.status(500).json({ error: 'Failed to process CSV import.' });
  }
});

// Load reference dataset
router.post('/admin/import/reference-dataset', authMiddleware, (req: Request, res: Response) => {
  try {
    const csvPath = path.resolve(process.cwd(), 'paynest_customer_feedback.csv');
    if (!fs.existsSync(csvPath)) {
      return res.status(404).json({ error: 'Reference dataset file paynest_customer_feedback.csv not found on server.' });
    }

    const csvData = fs.readFileSync(csvPath, 'utf-8');
    const parsed = Papa.parse(csvData, { header: true, skipEmptyLines: true });
    const rows = parsed.data as any[];

    const existingFeedback = db.getAllFeedback();
    const existingIds = new Set(existingFeedback.map((f) => f.feedback_id));

    const validRecords: FeedbackRecord[] = [];
    let skipped = 0;

    for (const r of rows) {
      if (!r.feedback_id || !r.raw_text) continue;
      const fId = String(r.feedback_id).trim();
      if (existingIds.has(fId)) {
        skipped++;
        continue;
      }

      validRecords.push({
        feedback_id: fId,
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
      existingIds.add(fId);
    }

    const result = db.bulkImportFeedback(validRecords, 'append');

    // Auto-analyze newly imported reference records immediately
    let negativeCount = 0;
    let positiveCount = 0;
    let neutralCount = 0;
    try {
      const analyses = validRecords.map((r) => fallbackAnalysis(r));
      db.bulkSaveAnalysis(analyses);

      for (const a of analyses) {
        if (a.sentiment === 'Negative') negativeCount++;
        else if (a.sentiment === 'Positive') positiveCount++;
        else neutralCount++;
      }

      const allFeedbackWithAnalysis = db.getAllFeedback().map((f) => ({
        ...f,
        analysis: db.getAnalysisByFeedbackId(f.feedback_id),
      }));
      synthesizeRecurringIssues(allFeedbackWithAnalysis).then((issues) => {
        db.setIssues(issues);
      }).catch((e) => console.error('Error synthesizing issues:', e));
    } catch (e) {
      console.error('Error auto-analyzing reference dataset:', e);
    }

    const job: ImportJob = {
      id: `JOB-REF-${Date.now().toString(36).toUpperCase()}`,
      filename: 'paynest_customer_feedback.csv (Reference Dataset)',
      imported_at: new Date().toISOString(),
      total_rows: rows.length,
      imported_count: result.imported,
      skipped_count: skipped + result.skipped,
      rejected_count: 0,
      validation_issues: [],
    };
    db.addImportJob(job);

    res.json({
      success: true,
      imported: result.imported,
      skipped: skipped + result.skipped,
      negativeCount,
      positiveCount,
      neutralCount,
      message: `Successfully loaded ${result.imported} records from reference dataset (${negativeCount} negative complaints detected).`,
    });
  } catch (err: any) {
    console.error('Error loading reference dataset:', err);
    res.status(500).json({ error: 'Failed to load reference dataset.' });
  }
});

router.get('/admin/import/history', authMiddleware, (req: Request, res: Response) => {
  res.json({ jobs: db.getImportJobs() });
});

// ==========================================
// 5. AI FEEDBACK ANALYSIS
// ==========================================

router.post('/admin/analysis/batch', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { batchSize = 10, forceAll = false, feedbackIds } = req.body;

    const allFeedback = db.getAllFeedback();
    const analysisMap = db.getAnalysisMap();

    let targetRecords: FeedbackRecord[] = [];

    if (feedbackIds && Array.isArray(feedbackIds) && feedbackIds.length > 0) {
      targetRecords = allFeedback.filter((f) => feedbackIds.includes(f.feedback_id));
    } else if (forceAll) {
      targetRecords = allFeedback;
    } else {
      // Unanalyzed records
      targetRecords = allFeedback.filter((f) => {
        const a = analysisMap.get(f.feedback_id);
        return !a || a.status !== 'Completed';
      });
    }

    if (targetRecords.length === 0) {
      return res.json({
        success: true,
        message: 'No pending records to analyze.',
        analyzed_count: 0,
        remaining_count: 0,
      });
    }

    const batch = targetRecords.slice(0, Math.min(Number(batchSize) || 10, 20));
    const results = await analyzeFeedbackBatch(batch);
    db.bulkSaveAnalysis(results);

    const remaining = targetRecords.length - batch.length;

    res.json({
      success: true,
      analyzed_count: results.length,
      remaining_count: Math.max(0, remaining),
      results,
    });
  } catch (err: any) {
    console.error('Error in batch analysis:', err);
    res.status(500).json({ error: 'Analysis batch failed.' });
  }
});

router.post('/admin/analysis/single/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const feedback = db.getFeedbackById(req.params.id);
    if (!feedback) {
      return res.status(404).json({ error: 'Feedback record not found.' });
    }

    const [result] = await analyzeFeedbackBatch([feedback]);
    db.saveAnalysis(result);

    res.json({ success: true, analysis: result });
  } catch (err: any) {
    console.error('Error analyzing single feedback:', err);
    res.status(500).json({ error: 'Failed to analyze feedback item.' });
  }
});

router.get('/admin/analysis/stats', authMiddleware, (req: Request, res: Response) => {
  const all = db.getAllFeedback();
  const analyses = db.getAllAnalysis();
  const map = db.getAnalysisMap();

  let completed = 0;
  let failed = 0;
  let pending = 0;

  for (const f of all) {
    const a = map.get(f.feedback_id);
    if (a && a.status === 'Completed') completed++;
    else if (a && a.status === 'Failed') failed++;
    else pending++;
  }

  res.json({
    total: all.length,
    completed,
    failed,
    pending,
  });
});

// ==========================================
// 6. RECURRING ISSUES & PRODUCT INSIGHTS
// ==========================================

router.get('/admin/insights', authMiddleware, (req: Request, res: Response) => {
  const issues = db.getAllIssues();
  res.json({ issues });
});

router.get('/admin/insights/:id', authMiddleware, (req: Request, res: Response) => {
  const issue = db.getIssueById(req.params.id);
  if (!issue) return res.status(404).json({ error: 'Recurring issue not found.' });

  const allFeedback = db.getAllFeedback();
  const supporting = allFeedback.filter((f) => issue.supporting_feedback_ids.includes(f.feedback_id));
  const analysisMap = db.getAnalysisMap();

  const supportingWithAnalysis = supporting.map((f) => ({
    ...f,
    analysis: analysisMap.get(f.feedback_id) || null,
  }));

  res.json({
    issue,
    supporting_feedback: supportingWithAnalysis,
  });
});

router.post('/admin/insights/synthesize', authMiddleware, async (req: Request, res: Response) => {
  try {
    const allFeedback = db.getAllFeedback();
    const analysisMap = db.getAnalysisMap();

    const withAnalysis = allFeedback.map((f) => ({
      ...f,
      analysis: analysisMap.get(f.feedback_id) || null,
    }));

    const issues = await synthesizeRecurringIssues(withAnalysis);
    db.setIssues(issues);

    res.json({
      success: true,
      issues_count: issues.length,
      issues,
    });
  } catch (err: any) {
    console.error('Error synthesizing issues:', err);
    res.status(500).json({ error: 'Failed to synthesize recurring issues.' });
  }
});

// ==========================================
// 7. PRODUCT REQUIREMENTS WORKSPACE
// ==========================================

router.get('/admin/requirements', authMiddleware, (req: Request, res: Response) => {
  const requirements = db.getAllRequirements();
  res.json({ requirements });
});

router.post('/admin/requirements/generate', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { issue_id } = req.body;
    if (!issue_id) return res.status(400).json({ error: 'issue_id is required.' });

    const issue = db.getIssueById(issue_id);
    if (!issue) return res.status(404).json({ error: 'Recurring issue not found.' });

    const allFeedback = db.getAllFeedback();
    const supporting = allFeedback.filter((f) => issue.supporting_feedback_ids.includes(f.feedback_id));

    const requirement = await generateProductRequirement(issue, supporting);
    db.saveRequirement(requirement);

    res.json({ success: true, requirement });
  } catch (err: any) {
    console.error('Error generating requirement:', err);
    res.status(500).json({ error: 'Failed to generate product requirement.' });
  }
});

router.post('/admin/requirements', authMiddleware, (req: Request, res: Response) => {
  try {
    const {
      title,
      problem_statement,
      evidence_summary,
      affected_customer_groups,
      proposed_solution,
      user_story,
      acceptance_criteria,
      priority,
      priority_rationale,
      supporting_feedback_ids = [],
      issue_id,
    } = req.body;

    if (!title || !problem_statement || !user_story) {
      return res.status(400).json({ error: 'Title, problem statement, and user story are required.' });
    }

    const newReq = db.saveRequirement({
      id: `REQ-${Date.now().toString(36).toUpperCase()}`,
      issue_id: issue_id || null,
      title: String(title).trim(),
      problem_statement: String(problem_statement).trim(),
      evidence_summary: String(evidence_summary || '').trim(),
      affected_customer_groups: String(affected_customer_groups || 'All Users').trim(),
      proposed_solution: String(proposed_solution || '').trim(),
      user_story: String(user_story).trim(),
      acceptance_criteria: Array.isArray(acceptance_criteria)
        ? acceptance_criteria
        : [String(acceptance_criteria)],
      priority: priority || 'Medium',
      priority_rationale: String(priority_rationale || '').trim(),
      supporting_feedback_ids: Array.isArray(supporting_feedback_ids) ? supporting_feedback_ids : [],
      review_status: 'Draft',
      review_notes: null,
      reviewed_by: null,
      reviewed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    res.json({ success: true, requirement: newReq });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create requirement.' });
  }
});

router.put('/admin/requirements/:id', authMiddleware, (req: Request, res: Response) => {
  const existing = db.getRequirementById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Requirement not found.' });

  const updated = db.saveRequirement({
    ...existing,
    ...req.body,
    id: existing.id,
    updated_at: new Date().toISOString(),
  });

  res.json({ success: true, requirement: updated });
});

router.patch('/admin/requirements/:id/review', authMiddleware, (req: Request, res: Response) => {
  const { status, review_notes } = req.body;
  if (!status) return res.status(400).json({ error: 'status is required.' });

  const adminName = (req as any).admin?.name || 'Admin';
  const updated = db.updateRequirementStatus(req.params.id, status, review_notes, adminName);
  if (!updated) return res.status(404).json({ error: 'Requirement not found.' });

  res.json({ success: true, requirement: updated });
});

router.get('/admin/requirements/export', authMiddleware, (req: Request, res: Response) => {
  const reqs = db.getAllRequirements();
  const format = req.query.format === 'excel' ? 'csv' : 'csv'; // Send CSV with proper MIME

  const rows = reqs.map((r) => ({
    id: r.id,
    title: r.title,
    priority: r.priority,
    status: r.review_status,
    problem_statement: r.problem_statement,
    user_story: r.user_story,
    acceptance_criteria: r.acceptance_criteria.join(' | '),
    affected_groups: r.affected_customer_groups,
    evidence_summary: r.evidence_summary,
    priority_rationale: r.priority_rationale,
    supporting_feedback_count: r.supporting_feedback_ids.length,
    reviewed_by: r.reviewed_by || '',
    reviewed_at: r.reviewed_at || '',
    created_at: r.created_at,
  }));

  const csv = Papa.unparse(rows);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="paynext_product_requirements.csv"');
  res.send(csv);
});

// ==========================================
// 8. DASHBOARD METRICS & CHARTS
// ==========================================

router.get('/admin/dashboard/metrics', authMiddleware, (req: Request, res: Response) => {
  try {
    const filters: GlobalFilterState = {
      dateRange: (req.query.dateRange as any) || 'all',
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      country: req.query.country as string,
      city: req.query.city as string,
      channel: req.query.channel as string,
      customerSegment: req.query.customerSegment as string,
      planTier: req.query.planTier as string,
      device: req.query.device as string,
      os: req.query.os as string,
      appVersion: req.query.appVersion as string,
      rating: req.query.rating ? Number(req.query.rating) : null,
      sentiment: req.query.sentiment as any,
    };

    const metrics = db.getDashboardMetrics(filters);
    res.json(metrics);
  } catch (err: any) {
    console.error('Error calculating dashboard metrics:', err);
    res.status(500).json({ error: 'Failed to compute dashboard metrics.' });
  }
});

router.get('/admin/dashboard/charts', authMiddleware, (req: Request, res: Response) => {
  try {
    const filters: GlobalFilterState = {
      dateRange: (req.query.dateRange as any) || 'all',
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      country: req.query.country as string,
      city: req.query.city as string,
      channel: req.query.channel as string,
      customerSegment: req.query.customerSegment as string,
      planTier: req.query.planTier as string,
      device: req.query.device as string,
      os: req.query.os as string,
      appVersion: req.query.appVersion as string,
      rating: req.query.rating ? Number(req.query.rating) : null,
      sentiment: req.query.sentiment as any,
    };

    const charts = db.getDashboardCharts(filters);
    res.json(charts);
  } catch (err: any) {
    console.error('Error fetching dashboard charts:', err);
    res.status(500).json({ error: 'Failed to compute dashboard charts.' });
  }
});

// ==========================================
// 9. FORM MANAGEMENT
// ==========================================

router.get('/admin/form-config', authMiddleware, (req: Request, res: Response) => {
  res.json({ config: db.getFormConfig() });
});

router.put('/admin/form-config', authMiddleware, (req: Request, res: Response) => {
  const updated = db.updateFormConfig(req.body);
  res.json({ success: true, config: updated });
});

// ==========================================
// 10. REPORTS & EXPORTS
// ==========================================

router.post('/admin/reports/generate', authMiddleware, (req: Request, res: Response) => {
  try {
    const { filters = {}, includeApprovedReqs = true, redactPII = true } = req.body;

    const feedback = db.getAllFeedback(filters);
    const analysisMap = db.getAnalysisMap();
    const metrics = db.getDashboardMetrics(filters);
    const charts = db.getDashboardCharts(filters);
    const issues = db.getAllIssues();
    const requirements = includeApprovedReqs
      ? db.getAllRequirements().filter((r) => r.review_status === 'Approved')
      : db.getAllRequirements();

    const report = {
      generatedAt: new Date().toISOString(),
      reportTitle: 'PayNext Customer Feedback Intelligence Report',
      metrics,
      charts,
      topRecurringProblems: issues.slice(0, 5),
      approvedRequirements: requirements,
      sampleRepresentativeComments: feedback.slice(0, 8).map((f) => ({
        feedback_id: f.feedback_id,
        channel: f.channel,
        country: f.country,
        rating: f.rating,
        raw_text: f.raw_text,
        customer_name: redactPII ? 'Redacted' : f.customer_name,
        email: redactPII ? 'Redacted' : f.email,
        sentiment: analysisMap.get(f.feedback_id)?.sentiment || 'Unanalyzed',
        category: analysisMap.get(f.feedback_id)?.primary_category || 'Unclassified',
      })),
    };

    res.json(report);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to generate report.' });
  }
});

router.get('/admin/reports/export-csv', authMiddleware, (req: Request, res: Response) => {
  const feedback = db.getAllFeedback();
  const analysisMap = db.getAnalysisMap();
  const redactPII = req.query.redactPII !== 'false';

  const rows = feedback.map((f) => {
    const a = analysisMap.get(f.feedback_id);
    return {
      feedback_id: f.feedback_id,
      customer_id: redactPII ? 'REDACTED' : f.customer_id || '',
      customer_name: redactPII ? 'REDACTED' : f.customer_name || '',
      email: redactPII ? 'REDACTED' : f.email || '',
      country: f.country,
      city: f.city || '',
      channel: f.channel,
      customer_segment: f.customer_segment || '',
      plan_tier: f.plan_tier || '',
      rating: f.rating ?? '',
      nps_score: f.nps_score ?? '',
      submitted_at: f.submitted_at,
      device: f.device || '',
      os: f.os || '',
      app_version: f.app_version || '',
      raw_text: f.raw_text,
      ai_sentiment: a?.sentiment || 'Pending',
      ai_category: a?.primary_category || '',
      ai_summary: a?.summary || '',
      ai_urgency: a?.urgency || '',
      ai_confidence: a?.confidence || '',
    };
  });

  const csv = Papa.unparse(rows);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="paynext_customer_feedback_export.csv"');
  res.send(csv);
});

// ==========================================
// 11. SETTINGS & SYSTEM MAINTENANCE
// ==========================================

router.get('/admin/settings/backup', authMiddleware, (req: Request, res: Response) => {
  const backup = db.exportData();
  // Strip password hashes from backup
  backup.adminUsers = backup.adminUsers.map((u: any) => ({
    ...u,
    passwordHash: 'REDACTED',
    salt: 'REDACTED',
  }));
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="paynext_database_backup.json"');
  res.send(JSON.stringify(backup, null, 2));
});

router.post('/admin/settings/reset', authMiddleware, (req: Request, res: Response) => {
  const { confirmation } = req.body;
  if (confirmation !== 'RESET_PAYNEXT_DATA') {
    return res.status(400).json({ error: 'Invalid confirmation phrase. Please type RESET_PAYNEXT_DATA.' });
  }

  db.resetAll();
  res.json({ success: true, message: 'All feedback, analysis, issues, and requirements have been cleared.' });
});
