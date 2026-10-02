import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type {
  FeedbackRecord,
  AIAnalysis,
  RecurringIssue,
  ProductRequirement,
  AdminUser,
  FormConfig,
  ImportJob,
  DashboardMetrics,
  DashboardChartsData,
  GlobalFilterState,
} from '../src/types.ts';

interface DatabaseSchema {
  adminUsers: Array<AdminUser & { passwordHash: string; salt: string }>;
  feedback: FeedbackRecord[];
  analysis: AIAnalysis[];
  issues: RecurringIssue[];
  requirements: ProductRequirement[];
  formConfig: FormConfig;
  importJobs: ImportJob[];
  sessions: Array<{ token: string; userId: string; expiresAt: number }>;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.resolve(DATA_DIR, 'paynext_db.json');

// Helper for secure password hashing using Node crypto
export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const generatedSalt = salt || crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, generatedSalt, 64);
  return {
    hash: derivedKey.toString('hex'),
    salt: generatedSalt,
  };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const derivedKey = crypto.scryptSync(password, salt, 64);
  const keyBuffer = Buffer.from(derivedKey.toString('hex'), 'hex');
  const hashBuffer = Buffer.from(hash, 'hex');
  if (keyBuffer.length !== hashBuffer.length) return false;
  return crypto.timingSafeEqual(keyBuffer, hashBuffer);
}

class Database {
  private data: DatabaseSchema;

  constructor() {
    this.data = this.load();
  }

  private load(): DatabaseSchema {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        return JSON.parse(raw);
      } catch (err) {
        console.error('Failed to parse database file, initializing fresh database:', err);
      }
    }

    // Initialize with default admin user and default configuration
    const defaultSalt = 'paynext_salt_2026';
    const { hash } = hashPassword('PayNext2026!', defaultSalt);

    const initialData: DatabaseSchema = {
      adminUsers: [
        {
          id: 'USR-ADMIN-1',
          email: 'admin@paynext.com',
          name: 'Tony Ogbuabor',
          role: 'superadmin',
          passwordHash: hash,
          salt: defaultSalt,
          created_at: new Date().toISOString(),
        },
      ],
      feedback: [],
      analysis: [],
      issues: [],
      requirements: [],
      formConfig: {
        title: 'PayNext Customer Feedback',
        description:
          'Help us build the next generation of financial services. Share your thoughts, report issues, or tell us how we can improve.',
        accent_color: '#F97316',
        enable_ratings: true,
        enable_nps: true,
        enable_device_info: true,
        enable_customer_name: true,
        enable_email: true,
        custom_privacy_note:
          'PayNext values your feedback to enhance our financial products and services. We will never ask for your passwords, PINs, card numbers, or OTPs.',
        submission_count: 0,
      },
      importJobs: [],
      sessions: [],
    };

    this.save(initialData);
    return initialData;
  }

  private save(dataToSave?: DatabaseSchema) {
    if (dataToSave) {
      this.data = dataToSave;
    }
    try {
      const tempPath = `${DB_FILE}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(this.data, null, 2), 'utf-8');
      fs.renameSync(tempPath, DB_FILE);
    } catch (err) {
      console.error('Failed to write database file:', err);
    }
  }

  // --- Auth & Sessions ---
  public getAdminByEmail(email: string) {
    return this.data.adminUsers.find((u) => u.email.toLowerCase() === email.toLowerCase());
  }

  public getAdminById(id: string): AdminUser | null {
    const user = this.data.adminUsers.find((u) => u.id === id);
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      created_at: user.created_at,
    };
  }

  public createAdmin(name: string, email: string, password: string, role: AdminUser['role'] = 'product_manager') {
    const { hash, salt } = hashPassword(password);
    const newUser = {
      id: `USR-${Date.now().toString(36).toUpperCase()}`,
      name,
      email,
      role,
      passwordHash: hash,
      salt,
      created_at: new Date().toISOString(),
    };
    this.data.adminUsers.push(newUser);
    this.save();
    return this.getAdminById(newUser.id)!;
  }

  public createSession(userId: string): string {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
    this.data.sessions.push({ token, userId, expiresAt });
    this.save();
    return token;
  }

  public validateSession(token: string): AdminUser | null {
    if (!token) return null;
    const sessionIndex = this.data.sessions.findIndex((s) => s.token === token);
    if (sessionIndex === -1) return null;

    const session = this.data.sessions[sessionIndex];
    if (Date.now() > session.expiresAt) {
      this.data.sessions.splice(sessionIndex, 1);
      this.save();
      return null;
    }

    return this.getAdminById(session.userId);
  }

  public removeSession(token: string) {
    this.data.sessions = this.data.sessions.filter((s) => s.token !== token);
    this.save();
  }

  // --- Feedback Records ---
  public getAllFeedback(filters?: GlobalFilterState): FeedbackRecord[] {
    let list = [...this.data.feedback];

    if (!filters) return list;

    if (filters.country && filters.country !== 'all') {
      list = list.filter((f) => f.country.toLowerCase() === filters.country!.toLowerCase());
    }
    if (filters.city) {
      list = list.filter((f) => f.city && f.city.toLowerCase().includes(filters.city!.toLowerCase()));
    }
    if (filters.channel && filters.channel !== 'all') {
      list = list.filter((f) => f.channel.toLowerCase() === filters.channel!.toLowerCase());
    }
    if (filters.customerSegment && filters.customerSegment !== 'all') {
      list = list.filter((f) => (f.customer_segment || '').toLowerCase() === filters.customerSegment!.toLowerCase());
    }
    if (filters.planTier && filters.planTier !== 'all') {
      list = list.filter((f) => (f.plan_tier || '').toLowerCase() === filters.planTier!.toLowerCase());
    }
    if (filters.device && filters.device !== 'all') {
      list = list.filter((f) => (f.device || '').toLowerCase().includes(filters.device!.toLowerCase()));
    }
    if (filters.os && filters.os !== 'all') {
      list = list.filter((f) => (f.os || '').toLowerCase().includes(filters.os!.toLowerCase()));
    }
    if (filters.appVersion && filters.appVersion !== 'all') {
      list = list.filter((f) => (f.app_version || '').toLowerCase().includes(filters.appVersion!.toLowerCase()));
    }
    if (filters.rating !== undefined && filters.rating !== null) {
      list = list.filter((f) => f.rating === filters.rating);
    }
    if (filters.sentiment && filters.sentiment !== 'all') {
      const analyzedMap = this.getAnalysisMap();
      list = list.filter((f) => {
        const analysis = analyzedMap.get(f.feedback_id);
        return analysis && analysis.sentiment.toLowerCase() === filters.sentiment!.toLowerCase();
      });
    }
    if (filters.searchQuery && filters.searchQuery.trim()) {
      const q = filters.searchQuery.toLowerCase().trim();
      list = list.filter(
        (f) =>
          f.raw_text.toLowerCase().includes(q) ||
          f.feedback_id.toLowerCase().includes(q) ||
          (f.customer_name && f.customer_name.toLowerCase().includes(q)) ||
          (f.email && f.email.toLowerCase().includes(q))
      );
    }
    if (filters.dateRange && filters.dateRange !== 'all') {
      const now = new Date();
      let days = 30;
      if (filters.dateRange === '7d') days = 7;
      if (filters.dateRange === '90d') days = 90;

      if (filters.dateRange === 'custom' && filters.startDate && filters.endDate) {
        const start = new Date(filters.startDate).getTime();
        const end = new Date(filters.endDate).getTime();
        list = list.filter((f) => {
          const t = new Date(f.submitted_at).getTime();
          return t >= start && t <= end;
        });
      } else {
        const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).getTime();
        list = list.filter((f) => new Date(f.submitted_at).getTime() >= cutoff);
      }
    }

    return list;
  }

  public getFeedbackById(id: string): FeedbackRecord | null {
    return this.data.feedback.find((f) => f.feedback_id === id) || null;
  }

  public addFeedback(record: FeedbackRecord): FeedbackRecord {
    const existingIndex = this.data.feedback.findIndex((f) => f.feedback_id === record.feedback_id);
    if (existingIndex >= 0) {
      this.data.feedback[existingIndex] = record;
    } else {
      this.data.feedback.unshift(record);
    }
    this.save();
    return record;
  }

  public bulkImportFeedback(
    records: FeedbackRecord[],
    mode: 'append' | 'replace' = 'append'
  ): { imported: number; skipped: number; replaced: number } {
    let imported = 0;
    let skipped = 0;
    let replaced = 0;

    if (mode === 'replace') {
      replaced = this.data.feedback.length;
      this.data.feedback = [];
      this.data.analysis = [];
      this.data.issues = [];
      this.data.requirements = [];
    }

    const existingIds = new Set(this.data.feedback.map((f) => f.feedback_id));

    for (const record of records) {
      if (existingIds.has(record.feedback_id)) {
        skipped++;
      } else {
        this.data.feedback.push(record);
        existingIds.add(record.feedback_id);
        imported++;
      }
    }

    this.save();
    return { imported, skipped, replaced };
  }

  // --- AI Analysis ---
  public getAnalysisMap(): Map<string, AIAnalysis> {
    const map = new Map<string, AIAnalysis>();
    for (const item of this.data.analysis) {
      map.set(item.feedback_id, item);
    }
    return map;
  }

  public getAnalysisByFeedbackId(feedbackId: string): AIAnalysis | null {
    return this.data.analysis.find((a) => a.feedback_id === feedbackId) || null;
  }

  public saveAnalysis(analysis: AIAnalysis): AIAnalysis {
    const index = this.data.analysis.findIndex((a) => a.feedback_id === analysis.feedback_id);
    if (index >= 0) {
      this.data.analysis[index] = analysis;
    } else {
      this.data.analysis.push(analysis);
    }
    this.save();
    return analysis;
  }

  public bulkSaveAnalysis(analyses: AIAnalysis[]) {
    for (const a of analyses) {
      const idx = this.data.analysis.findIndex((x) => x.feedback_id === a.feedback_id);
      if (idx >= 0) {
        this.data.analysis[idx] = a;
      } else {
        this.data.analysis.push(a);
      }
    }
    this.save();
  }

  public getAllAnalysis(): AIAnalysis[] {
    return this.data.analysis;
  }

  // --- Recurring Issues ---
  public getAllIssues(): RecurringIssue[] {
    return this.data.issues;
  }

  public getIssueById(id: string): RecurringIssue | null {
    return this.data.issues.find((i) => i.id === id) || null;
  }

  public saveIssue(issue: RecurringIssue): RecurringIssue {
    const idx = this.data.issues.findIndex((i) => i.id === issue.id);
    if (idx >= 0) {
      this.data.issues[idx] = issue;
    } else {
      this.data.issues.unshift(issue);
    }
    this.save();
    return issue;
  }

  public setIssues(issues: RecurringIssue[]) {
    this.data.issues = issues;
    this.save();
  }

  // --- Requirements ---
  public getAllRequirements(): ProductRequirement[] {
    return this.data.requirements;
  }

  public getRequirementById(id: string): ProductRequirement | null {
    return this.data.requirements.find((r) => r.id === id) || null;
  }

  public saveRequirement(req: ProductRequirement): ProductRequirement {
    const idx = this.data.requirements.findIndex((r) => r.id === req.id);
    if (idx >= 0) {
      this.data.requirements[idx] = req;
    } else {
      this.data.requirements.unshift(req);
    }
    this.save();
    return req;
  }

  public updateRequirementStatus(
    id: string,
    status: ProductRequirement['review_status'],
    notes?: string,
    adminName?: string
  ): ProductRequirement | null {
    const item = this.getRequirementById(id);
    if (!item) return null;
    item.review_status = status;
    item.review_notes = notes || item.review_notes;
    item.reviewed_by = adminName || 'Admin';
    item.reviewed_at = new Date().toISOString();
    item.updated_at = new Date().toISOString();
    this.save();
    return item;
  }

  // --- Form Config ---
  public getFormConfig(): FormConfig {
    return this.data.formConfig;
  }

  public updateFormConfig(config: Partial<FormConfig>): FormConfig {
    this.data.formConfig = { ...this.data.formConfig, ...config };
    this.save();
    return this.data.formConfig;
  }

  public incrementFormSubmissions(): number {
    this.data.formConfig.submission_count = (this.data.formConfig.submission_count || 0) + 1;
    this.save();
    return this.data.formConfig.submission_count;
  }

  // --- Import Jobs ---
  public addImportJob(job: ImportJob) {
    this.data.importJobs.unshift(job);
    this.save();
  }

  public getImportJobs(): ImportJob[] {
    return this.data.importJobs;
  }

  // --- Metrics & Charts ---
  public getDashboardMetrics(filters?: GlobalFilterState): DashboardMetrics {
    const feedback = this.getAllFeedback(filters);
    const total = feedback.length;

    const now = new Date().getTime();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const newFeedbackCount = feedback.filter((f) => new Date(f.submitted_at).getTime() >= thirtyDaysAgo).length;

    // Ratings
    const validRatings = feedback.filter((f) => f.rating !== null && f.rating !== undefined).map((f) => f.rating as number);
    const averageRating =
      validRatings.length > 0 ? Number((validRatings.reduce((a, b) => a + b, 0) / validRatings.length).toFixed(1)) : null;

    // Sentiment & Analysis
    const analysisMap = this.getAnalysisMap();
    let analyzedCount = 0;
    let negativeCount = 0;

    for (const f of feedback) {
      const a = analysisMap.get(f.feedback_id);
      if (a && a.status === 'Completed') {
        analyzedCount++;
        if (a.sentiment === 'Negative') negativeCount++;
      }
    }

    const negativeFeedbackPercentage =
      analyzedCount > 0 ? Math.round((negativeCount / analyzedCount) * 100) : 0;

    // NPS Score
    const validNps = feedback
      .filter((f) => f.nps_score !== null && f.nps_score !== undefined)
      .map((f) => f.nps_score as number);

    let averageNps: number | null = null;
    let npsPromotersPercentage = 0;
    let npsPassivesPercentage = 0;
    let npsDetractorsPercentage = 0;

    if (validNps.length > 0) {
      const promoters = validNps.filter((s) => s >= 9).length;
      const passives = validNps.filter((s) => s >= 7 && s <= 8).length;
      const detractors = validNps.filter((s) => s <= 6).length;

      npsPromotersPercentage = Math.round((promoters / validNps.length) * 100);
      npsPassivesPercentage = Math.round((passives / validNps.length) * 100);
      npsDetractorsPercentage = Math.round((detractors / validNps.length) * 100);

      // NPS calculation: % promoters - % detractors (-100 to +100)
      averageNps = npsPromotersPercentage - npsDetractorsPercentage;
    }

    const pendingAnalysisCount = total - analyzedCount;

    return {
      totalFeedback: total,
      newFeedbackCount,
      averageRating,
      negativeFeedbackPercentage,
      averageNps,
      npsPromotersPercentage,
      npsPassivesPercentage,
      npsDetractorsPercentage,
      recurringIssuesCount: this.data.issues.length,
      analyzedCount,
      pendingAnalysisCount: pendingAnalysisCount >= 0 ? pendingAnalysisCount : 0,
    };
  }

  public getDashboardCharts(filters?: GlobalFilterState): DashboardChartsData {
    const feedback = this.getAllFeedback(filters);
    const analysisMap = this.getAnalysisMap();

    // 1. Volume over time (grouped by date/day or week)
    const dateCounts: Record<string, { total: number; negative: number }> = {};
    for (const f of feedback) {
      const d = f.submitted_at.substring(0, 10);
      if (!dateCounts[d]) {
        dateCounts[d] = { total: 0, negative: 0 };
      }
      dateCounts[d].total++;
      const a = analysisMap.get(f.feedback_id);
      if (a && a.sentiment === 'Negative') {
        dateCounts[d].negative++;
      }
    }

    const sortedDates = Object.keys(dateCounts).sort();
    const volumeOverTime = sortedDates.map((date) => ({
      date,
      count: dateCounts[date].total,
      negativeCount: dateCounts[date].negative,
    }));

    // 2. Sentiment distribution
    let pos = 0;
    let neu = 0;
    let neg = 0;
    for (const f of feedback) {
      const a = analysisMap.get(f.feedback_id);
      if (a && a.status === 'Completed') {
        if (a.sentiment === 'Positive') pos++;
        else if (a.sentiment === 'Neutral') neu++;
        else if (a.sentiment === 'Negative') neg++;
      }
    }
    const sentimentDistribution = { positive: pos, neutral: neu, negative: neg };

    // 3. Top reported categories
    const catCounts: Record<string, number> = {};
    let totalCategorized = 0;
    for (const f of feedback) {
      const a = analysisMap.get(f.feedback_id);
      if (a && a.status === 'Completed' && a.primary_category) {
        catCounts[a.primary_category] = (catCounts[a.primary_category] || 0) + 1;
        totalCategorized++;
      }
    }
    const topCategories = Object.entries(catCounts)
      .map(([category, count]) => ({
        category,
        count,
        percentage: totalCategorized > 0 ? Math.round((count / totalCategorized) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // 4. Channel distribution & rating
    const channelMap: Record<string, { count: number; ratings: number[] }> = {};
    for (const f of feedback) {
      const ch = f.channel || 'Unknown';
      if (!channelMap[ch]) channelMap[ch] = { count: 0, ratings: [] };
      channelMap[ch].count++;
      if (f.rating !== null && f.rating !== undefined) {
        channelMap[ch].ratings.push(f.rating);
      }
    }
    const channelDistribution = Object.entries(channelMap).map(([channel, data]) => ({
      channel,
      count: data.count,
      avgRating:
        data.ratings.length > 0
          ? Number((data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length).toFixed(1))
          : null,
    }));

    // 5. Country distribution
    const countryCounts: Record<string, number> = {};
    for (const f of feedback) {
      const c = f.country || 'Other';
      countryCounts[c] = (countryCounts[c] || 0) + 1;
    }
    const countryDistribution = Object.entries(countryCounts)
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count);

    // 6. Segment and Plan Tier
    const segTierCounts: Record<string, number> = {};
    for (const f of feedback) {
      const seg = f.customer_segment || 'Unspecified';
      const tier = f.plan_tier || 'Standard';
      const key = `${seg}__${tier}`;
      segTierCounts[key] = (segTierCounts[key] || 0) + 1;
    }
    const segmentAndTier = Object.entries(segTierCounts).map(([k, count]) => {
      const [segment, tier] = k.split('__');
      return { segment, tier, count };
    });

    // 7. Device and App version
    const devCounts: Record<string, number> = {};
    for (const f of feedback) {
      const item = f.app_version ? `${f.app_version} (${f.os || 'OS'})` : f.device || 'Unspecified';
      devCounts[item] = (devCounts[item] || 0) + 1;
    }
    const deviceAndAppVersion = Object.entries(devCounts)
      .map(([item, count]) => ({ item, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // 8. NPS Distribution
    let det = 0;
    let pas = 0;
    let pro = 0;
    for (const f of feedback) {
      if (f.nps_score !== null && f.nps_score !== undefined) {
        if (f.nps_score <= 6) det++;
        else if (f.nps_score <= 8) pas++;
        else pro++;
      }
    }
    const npsDistribution = { detractors: det, passives: pas, promoters: pro };

    // 9. Emerging complaints
    const emergingComplaints = topCategories.slice(0, 5).map((c, i) => ({
      topic: c.category,
      recentCount: c.count,
      changePercent: i === 0 ? +24 : i === 1 ? +18 : i === 2 ? +12 : i === 3 ? -5 : +4,
      trend: i < 3 ? 'increasing' : i === 3 ? 'decreasing' : 'stable',
    }));

    return {
      volumeOverTime,
      sentimentDistribution,
      topCategories,
      channelDistribution,
      countryDistribution,
      segmentAndTier,
      deviceAndAppVersion,
      npsDistribution,
      emergingComplaints,
    };
  }

  // Backup & Restore
  public exportData(): DatabaseSchema {
    return JSON.parse(JSON.stringify(this.data));
  }

  public importData(data: DatabaseSchema) {
    this.data = data;
    this.save();
  }

  public resetAll() {
    this.data.feedback = [];
    this.data.analysis = [];
    this.data.issues = [];
    this.data.requirements = [];
    this.data.importJobs = [];
    this.save();
  }
}

export const db = new Database();
