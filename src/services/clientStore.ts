import type {
  AdminUser,
  FeedbackRecord,
  FeedbackWithAnalysis,
  AIAnalysis,
  RecurringIssue,
  ProductRequirement,
  FormConfig,
  ImportJob,
  DashboardMetrics,
  DashboardChartsData,
  GlobalFilterState,
  RequirementReviewStatus,
} from '../types';
import seedDataRaw from '../data/initialData.json';

interface DatabaseSchema {
  adminUsers: AdminUser[];
  feedback: FeedbackRecord[];
  analysis: AIAnalysis[];
  issues: RecurringIssue[];
  requirements: ProductRequirement[];
  formConfig: FormConfig;
  importJobs: ImportJob[];
}

const STORAGE_KEY = 'paynext_client_db_v1';

class ClientStore {
  private data: DatabaseSchema;
  private currentUser: AdminUser;

  constructor() {
    this.currentUser = {
      id: 'USR-ADMIN-1',
      email: 'admin@paynext.com',
      name: 'Tony Ogbuabor',
      role: 'superadmin',
      created_at: '2026-09-30T11:01:54.340Z',
    };
    this.data = this.loadData();
  }

  private loadData(): DatabaseSchema {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && Array.isArray(parsed.feedback) && parsed.feedback.length > 0) {
            return parsed;
          }
        }
      } catch (e) {
        console.warn('[PayNext ClientStore] LocalStorage read failed, falling back to seed dataset:', e);
      }
    }

    const defaultData: DatabaseSchema = {
      adminUsers: (seedDataRaw as any).adminUsers || [this.currentUser],
      feedback: (seedDataRaw as any).feedback || [],
      analysis: (seedDataRaw as any).analysis || [],
      issues: (seedDataRaw as any).issues || [],
      requirements: (seedDataRaw as any).requirements || [],
      formConfig: (seedDataRaw as any).formConfig || {
        title: 'PayNext Customer Feedback',
        description: 'Help us build the next generation of financial services.',
        accent_color: '#F97316',
        enable_ratings: true,
        enable_nps: true,
        enable_device_info: true,
        enable_customer_name: true,
        enable_email: true,
        custom_privacy_note: 'PayNext values your feedback to enhance our financial products.',
        submission_count: 831,
      },
      importJobs: (seedDataRaw as any).importJobs || [],
    };

    this.saveData(defaultData);
    return defaultData;
  }

  private saveData(dataToSave: DatabaseSchema = this.data) {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
      } catch (e) {
        console.warn('[PayNext ClientStore] LocalStorage write failed:', e);
      }
    }
  }

  // Auth
  public login(_email: string, _password: string): { token: string; user: AdminUser } {
    return {
      token: 'client-token-paynext-' + Date.now(),
      user: this.currentUser,
    };
  }

  public getCurrentUser(): { user: AdminUser } {
    return { user: this.currentUser };
  }

  // Feedback Records
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
        const a = analyzedMap.get(f.feedback_id);
        return a && a.sentiment.toLowerCase() === filters.sentiment!.toLowerCase();
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

  public getFeedback(params: {
    page?: number;
    limit?: number;
    filters?: GlobalFilterState;
  }): {
    data: FeedbackWithAnalysis[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  } {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const all = this.getAllFeedback(params.filters);
    const analysisMap = this.getAnalysisMap();

    const total = all.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const start = (page - 1) * limit;
    const paged = all.slice(start, start + limit);

    const data: FeedbackWithAnalysis[] = paged.map((f) => ({
      ...f,
      analysis: analysisMap.get(f.feedback_id) || null,
    }));

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  public getFeedbackDetail(id: string): {
    feedback: FeedbackRecord;
    analysis: AIAnalysis | null;
    linked_issues: RecurringIssue[];
    linked_requirements: ProductRequirement[];
  } {
    const feedback = this.data.feedback.find((f) => f.feedback_id === id);
    if (!feedback) throw new Error('Feedback not found');
    const analysis = this.getAnalysisMap().get(id) || null;
    const linked_issues = this.data.issues.filter((issue) =>
      issue.supporting_feedback_ids.includes(id)
    );
    const linked_requirements = this.data.requirements.filter((req) =>
      linked_issues.some((issue) => issue.id === req.issue_id)
    );

    return { feedback, analysis, linked_issues, linked_requirements };
  }

  public addFeedback(record: FeedbackRecord): FeedbackRecord {
    const existingIndex = this.data.feedback.findIndex((f) => f.feedback_id === record.feedback_id);
    if (existingIndex >= 0) {
      this.data.feedback[existingIndex] = record;
    } else {
      this.data.feedback.unshift(record);
    }

    const lower = (record.raw_text || '').toLowerCase();
    let category = 'Customer Experience';
    let productArea = 'Core Banking';

    if (lower.includes('transfer') || lower.includes('payment') || lower.includes('debit') || lower.includes('reversal') || lower.includes('instant')) {
      category = 'Transfers & Instant Payments';
      productArea = 'Payment Processing';
    } else if (lower.includes('card') || lower.includes('atm') || lower.includes('pos') || lower.includes('declined') || lower.includes('pin')) {
      category = 'Cards & Virtual Cards';
      productArea = 'Card Services';
    } else if (lower.includes('kyc') || lower.includes('verify') || lower.includes('document') || lower.includes('bvn') || lower.includes('passport')) {
      category = 'Account Verification & KYC';
      productArea = 'Identity & Compliance';
    } else if (lower.includes('loan') || lower.includes('credit') || lower.includes('interest') || lower.includes('disburse')) {
      category = 'Loan & Credit Facilities';
      productArea = 'Lending';
    } else if (lower.includes('crash') || lower.includes('freeze') || lower.includes('bug') || lower.includes('login') || lower.includes('otp')) {
      category = 'Mobile App Performance';
      productArea = 'Mobile Client';
    } else if (lower.includes('support') || lower.includes('agent') || lower.includes('ticket') || lower.includes('chat') || lower.includes('reply')) {
      category = 'Customer Support';
      productArea = 'Helpdesk Operations';
    }

    const sentiment = record.rating && record.rating >= 4 ? 'Positive' : record.rating === 3 ? 'Neutral' : 'Negative';
    let urgency: 'Critical' | 'High' | 'Medium' | 'Low' = 'Low';
    if (sentiment === 'Negative') {
      urgency = (record.rating && record.rating <= 2) || lower.includes('urgent') || lower.includes('locked') || lower.includes('fraud') || lower.includes('stolen') ? 'Critical' : 'High';
    } else if (sentiment === 'Neutral') {
      urgency = 'Medium';
    }

    const autoAnalysis: AIAnalysis = {
      id: 'ANL-' + record.feedback_id,
      feedback_id: record.feedback_id,
      sentiment,
      primary_category: category,
      secondary_category: 'Customer Submission',
      summary: record.raw_text.slice(0, 140),
      product_area: productArea,
      customer_pain_point: record.raw_text.slice(0, 160),
      urgency,
      evidence: record.raw_text,
      confidence: 'High',
      is_unclear: false,
      status: 'Completed',
      analyzed_at: new Date().toISOString(),
    };
    this.data.analysis.unshift(autoAnalysis);
    this.saveData();
    return record;
  }

  // AI Analysis
  public getAnalysisMap(): Map<string, AIAnalysis> {
    const map = new Map<string, AIAnalysis>();
    for (const item of this.data.analysis) {
      map.set(item.feedback_id, item);
    }
    return map;
  }

  public getAnalysisStats() {
    const total = this.data.feedback.length;
    const completed = this.data.analysis.filter((a) => a.status === 'Completed').length;
    const failed = this.data.analysis.filter((a) => a.status === 'Failed').length;
    const pending = total - completed - failed;
    return {
      total,
      completed,
      failed,
      pending: pending > 0 ? pending : 0,
    };
  }

  public triggerBatchAnalysis(batchSize = 10, forceAll = false, feedbackIds?: string[]) {
    const analyzedMap = this.getAnalysisMap();
    let targets = feedbackIds
      ? this.data.feedback.filter((f) => feedbackIds.includes(f.feedback_id))
      : this.data.feedback;

    if (!forceAll && !feedbackIds) {
      targets = targets.filter((f) => !analyzedMap.has(f.feedback_id));
    }

    const batch = targets.slice(0, batchSize);
    const results: AIAnalysis[] = [];

    for (const f of batch) {
      const sentiment = f.rating && f.rating >= 4 ? 'Positive' : f.rating === 3 ? 'Neutral' : 'Negative';
      const a: AIAnalysis = {
        id: 'ANL-' + f.feedback_id,
        feedback_id: f.feedback_id,
        sentiment,
        primary_category: 'Service Reliability',
        secondary_category: 'Transaction Processing',
        summary: f.raw_text.slice(0, 100),
        product_area: 'Transactions',
        customer_pain_point: f.raw_text.slice(0, 120),
        urgency: sentiment === 'Negative' ? 'Medium' : 'Low',
        evidence: f.raw_text,
        confidence: 'High',
        is_unclear: false,
        status: 'Completed',
        analyzed_at: new Date().toISOString(),
      };
      results.push(a);
      const existingIdx = this.data.analysis.findIndex((x) => x.feedback_id === f.feedback_id);
      if (existingIdx >= 0) {
        this.data.analysis[existingIdx] = a;
      } else {
        this.data.analysis.push(a);
      }
    }

    this.saveData();
    return {
      success: true,
      analyzed_count: results.length,
      remaining_count: Math.max(0, targets.length - results.length),
      results,
    };
  }

  // Dashboard Metrics & Charts
  public getDashboardMetrics(filters?: GlobalFilterState): DashboardMetrics {
    const feedback = this.getAllFeedback(filters);
    const analysisMap = this.getAnalysisMap();
    const total = feedback.length;

    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const newFeedbackCount = feedback.filter(
      (f) => new Date(f.submitted_at).getTime() >= thirtyDaysAgo
    ).length;

    const rated = feedback.filter((f) => f.rating !== null && f.rating !== undefined);
    const averageRating =
      rated.length > 0
        ? Number((rated.reduce((sum, f) => sum + (f.rating as number), 0) / rated.length).toFixed(1))
        : null;

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

    // 1. Volume over time
    const dateCounts: Record<string, { total: number; negative: number }> = {};
    for (const f of feedback) {
      const d = f.submitted_at.substring(0, 10);
      if (!dateCounts[d]) dateCounts[d] = { total: 0, negative: 0 };
      dateCounts[d].total++;
      const a = analysisMap.get(f.feedback_id);
      if (a && a.sentiment === 'Negative') dateCounts[d].negative++;
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

    // 3. Top categories
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

    // 4. Channel distribution
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

    // 6. Segment and Tier
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

  // Insights
  public getInsights(): { issues: RecurringIssue[] } {
    return { issues: this.data.issues };
  }

  public getInsightDetail(id: string): {
    issue: RecurringIssue;
    supporting_feedback: FeedbackWithAnalysis[];
  } {
    const issue = this.data.issues.find((i) => i.id === id);
    if (!issue) throw new Error('Issue not found');
    const analysisMap = this.getAnalysisMap();
    const supporting_feedback: FeedbackWithAnalysis[] = this.data.feedback
      .filter((f) => issue.supporting_feedback_ids.includes(f.feedback_id))
      .map((f) => ({
        ...f,
        analysis: analysisMap.get(f.feedback_id) || null,
      }));
    return { issue, supporting_feedback };
  }

  public synthesizeIssues() {
    return {
      success: true,
      issues_count: this.data.issues.length,
      issues: this.data.issues,
    };
  }

  // Requirements
  public getRequirements(): { requirements: ProductRequirement[] } {
    return { requirements: this.data.requirements };
  }

  public generateRequirement(issue_id: string): {
    success: boolean;
    requirement: ProductRequirement;
  } {
    const issue = this.data.issues.find((i) => i.id === issue_id);
    const title = issue ? `Address ${issue.title}` : `Product Requirement PRD-${Date.now().toString().slice(-4)}`;
    const req: ProductRequirement = {
      id: 'REQ-' + Date.now().toString().slice(-6),
      issue_id,
      title,
      problem_statement: issue?.description || 'Customers experience repeated friction during transaction cycles.',
      evidence_summary: `Observed across ${issue?.supporting_feedback_ids?.length || 15} customer feedback reports.`,
      affected_customer_groups: 'Retail Mobile App Users, SME Merchants',
      proposed_solution: 'Introduce real-time transaction tracking and instant status callback notifications.',
      user_story: 'As an active customer, I want real-time notification of transaction status so that I avoid duplicated payments.',
      acceptance_criteria: [
        'Display live pending state with visual progress indicator.',
        'Send push confirmation within 3 seconds of transaction settlement.',
      ],
      priority: 'High',
      priority_rationale: 'High customer impact and repeated friction in core financial operations.',
      supporting_feedback_ids: issue?.supporting_feedback_ids || [],
      review_status: 'Draft',
      review_notes: null,
      reviewed_by: null,
      reviewed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.data.requirements.unshift(req);
    this.saveData();
    return { success: true, requirement: req };
  }

  public createRequirement(data: Partial<ProductRequirement>): {
    success: boolean;
    requirement: ProductRequirement;
  } {
    const req: ProductRequirement = {
      id: 'REQ-' + Date.now().toString().slice(-6),
      issue_id: data.issue_id || null,
      title: data.title || 'Untitled Requirement',
      problem_statement: data.problem_statement || '',
      evidence_summary: data.evidence_summary || '',
      affected_customer_groups: data.affected_customer_groups || 'All Users',
      proposed_solution: data.proposed_solution || '',
      user_story: data.user_story || 'As a user, I want reliable functionality.',
      acceptance_criteria: data.acceptance_criteria || [],
      priority: data.priority || 'Medium',
      priority_rationale: data.priority_rationale || '',
      supporting_feedback_ids: data.supporting_feedback_ids || [],
      review_status: 'Draft',
      review_notes: null,
      reviewed_by: null,
      reviewed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...data,
    };
    this.data.requirements.unshift(req);
    this.saveData();
    return { success: true, requirement: req };
  }

  public updateRequirement(id: string, data: Partial<ProductRequirement>): {
    success: boolean;
    requirement: ProductRequirement;
  } {
    const idx = this.data.requirements.findIndex((r) => r.id === id);
    if (idx < 0) throw new Error('Requirement not found');
    const updated = {
      ...this.data.requirements[idx],
      ...data,
      updated_at: new Date().toISOString(),
    };
    this.data.requirements[idx] = updated;
    this.saveData();
    return { success: true, requirement: updated };
  }

  public reviewRequirement(id: string, status: string, review_notes?: string): {
    success: boolean;
    requirement: ProductRequirement;
  } {
    const idx = this.data.requirements.findIndex((r) => r.id === id);
    if (idx < 0) throw new Error('Requirement not found');
    const updated: ProductRequirement = {
      ...this.data.requirements[idx],
      review_status: status as RequirementReviewStatus,
      reviewed_by: this.currentUser.name,
      reviewed_at: new Date().toISOString(),
      review_notes: review_notes || this.data.requirements[idx].review_notes,
      updated_at: new Date().toISOString(),
    };
    this.data.requirements[idx] = updated;
    this.saveData();
    return { success: true, requirement: updated };
  }

  // Form Config
  public getFormConfig(): { config: FormConfig } {
    return { config: this.data.formConfig };
  }

  public updateFormConfig(config: Partial<FormConfig>): { success: boolean; config: FormConfig } {
    this.data.formConfig = { ...this.data.formConfig, ...config };
    this.saveData();
    return { success: true, config: this.data.formConfig };
  }

  // Public Feedback Form
  public submitPublicFeedback(data: Partial<FeedbackRecord>): {
    success: boolean;
    feedback_id: string;
    message: string;
  } {
    const feedback_id = 'FB-WEB-' + Math.random().toString(36).substring(2, 9).toUpperCase();
    const custId = data.customer_id || ('CUST-WEB-' + Math.random().toString(36).substring(2, 7).toUpperCase());
    const record: FeedbackRecord = {
      feedback_id,
      customer_id: custId,
      customer_name: data.customer_name || 'Verified Customer',
      email: data.email,
      country: data.country || 'Nigeria',
      city: data.city,
      customer_segment: data.customer_segment || 'Retail',
      plan_tier: data.plan_tier || 'Standard',
      account_tenure_months: data.account_tenure_months !== undefined ? data.account_tenure_months : 12,
      channel: 'Web Feedback Form',
      submitted_at: new Date().toISOString(),
      rating: data.rating !== undefined ? data.rating : null,
      nps_score: data.nps_score !== undefined ? data.nps_score : null,
      device: data.device || 'Web Browser',
      os: data.os || (typeof navigator !== 'undefined' ? navigator.platform : 'Web'),
      app_version: data.app_version || 'Web Portal v2.4',
      raw_text: data.raw_text || '',
      created_at: new Date().toISOString(),
      source: 'web_form',
    };
    this.addFeedback(record);
    this.data.formConfig.submission_count = (this.data.formConfig.submission_count || 0) + 1;
    this.saveData();
    return {
      success: true,
      feedback_id,
      message: 'Thank you for your feedback! It has been submitted and analyzed.',
    };
  }

  // Reset Data
  public resetData(confirmation: string): { success: boolean; message: string } {
    if (confirmation !== 'RESET_PAYNEXT_DATA') {
      throw new Error('Invalid confirmation token');
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(STORAGE_KEY);
    }
    this.data = this.loadData();
    return { success: true, message: 'All feedback and analysis restored to baseline seed records.' };
  }
}

export const clientStore = new ClientStore();
