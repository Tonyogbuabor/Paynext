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
} from '../types';
import { clientStore } from './clientStore';

const TOKEN_KEY = 'paynext_admin_token';

export function getStoredToken(): string | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    return localStorage.getItem(TOKEN_KEY);
  }
  return null;
}

export function setStoredToken(token: string | null) {
  if (typeof window !== 'undefined' && window.localStorage) {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  }
}

let useLocalFallback = false;

export function isUsingClientFallback(): boolean {
  return useLocalFallback;
}

function filtersFromParams(params: URLSearchParams): GlobalFilterState {
  const filters: GlobalFilterState = {
    dateRange: (params.get('dateRange') as any) || 'all',
  };
  if (params.get('startDate')) filters.startDate = params.get('startDate')!;
  if (params.get('endDate')) filters.endDate = params.get('endDate')!;
  if (params.get('country')) filters.country = params.get('country')!;
  if (params.get('city')) filters.city = params.get('city')!;
  if (params.get('channel')) filters.channel = params.get('channel')!;
  if (params.get('customerSegment')) filters.customerSegment = params.get('customerSegment')!;
  if (params.get('planTier')) filters.planTier = params.get('planTier')!;
  if (params.get('device')) filters.device = params.get('device')!;
  if (params.get('os')) filters.os = params.get('os')!;
  if (params.get('appVersion')) filters.appVersion = params.get('appVersion')!;
  if (params.get('sentiment')) filters.sentiment = params.get('sentiment') as any;
  if (params.get('rating')) filters.rating = Number(params.get('rating'));
  if (params.get('q')) filters.searchQuery = params.get('q')!;
  return filters;
}

function executeClientFallback<T>(endpoint: string, options: RequestInit = {}): T {
  const [pathname, search] = endpoint.split('?');
  const params = new URLSearchParams(search || '');
  const method = (options.method || 'GET').toUpperCase();

  let body: any = {};
  if (options.body && typeof options.body === 'string') {
    try {
      body = JSON.parse(options.body);
    } catch {
      body = {};
    }
  }

  // Dashboard
  if (pathname === '/api/admin/dashboard/metrics') {
    const filters = filtersFromParams(params);
    return clientStore.getDashboardMetrics(filters) as unknown as T;
  }
  if (pathname === '/api/admin/dashboard/charts') {
    const filters = filtersFromParams(params);
    return clientStore.getDashboardCharts(filters) as unknown as T;
  }

  // Feedback
  if (pathname === '/api/admin/feedback') {
    const page = Number(params.get('page')) || 1;
    const limit = Number(params.get('limit')) || 20;
    const filters = filtersFromParams(params);
    return clientStore.getFeedback({ page, limit, filters }) as unknown as T;
  }
  if (pathname.startsWith('/api/admin/feedback/')) {
    const id = pathname.replace('/api/admin/feedback/', '');
    return clientStore.getFeedbackDetail(id) as unknown as T;
  }

  // Insights
  if (pathname === '/api/admin/insights') {
    return clientStore.getInsights() as unknown as T;
  }
  if (pathname === '/api/admin/insights/synthesize') {
    return clientStore.synthesizeIssues() as unknown as T;
  }
  if (pathname.startsWith('/api/admin/insights/')) {
    const id = pathname.replace('/api/admin/insights/', '');
    return clientStore.getInsightDetail(id) as unknown as T;
  }

  // Requirements
  if (pathname === '/api/admin/requirements') {
    if (method === 'POST') {
      return clientStore.createRequirement(body) as unknown as T;
    }
    return clientStore.getRequirements() as unknown as T;
  }
  if (pathname === '/api/admin/requirements/generate') {
    return clientStore.generateRequirement(body.issue_id) as unknown as T;
  }
  const reviewMatch = pathname.match(/^\/api\/admin\/requirements\/([^/]+)\/review$/);
  if (reviewMatch) {
    return clientStore.reviewRequirement(reviewMatch[1], body.status, body.review_notes) as unknown as T;
  }
  if (pathname.startsWith('/api/admin/requirements/')) {
    const id = pathname.replace('/api/admin/requirements/', '');
    return clientStore.updateRequirement(id, body) as unknown as T;
  }

  // Form Config
  if (pathname === '/api/public/form-config') {
    return clientStore.getFormConfig().config as unknown as T;
  }
  if (pathname === '/api/admin/form-config') {
    if (method === 'PUT') {
      return clientStore.updateFormConfig(body) as unknown as T;
    }
    return clientStore.getFormConfig() as unknown as T;
  }
  if (pathname === '/api/public/feedback') {
    return clientStore.submitPublicFeedback(body) as unknown as T;
  }

  // Analysis
  if (pathname === '/api/admin/analysis/stats') {
    return clientStore.getAnalysisStats() as unknown as T;
  }
  if (pathname === '/api/admin/analysis/batch') {
    return clientStore.triggerBatchAnalysis(body.batchSize, body.forceAll, body.feedbackIds) as unknown as T;
  }
  if (pathname.startsWith('/api/admin/analysis/single/')) {
    const id = pathname.replace('/api/admin/analysis/single/', '');
    const a = clientStore.getAnalysisMap().get(id);
    return { success: true, analysis: a } as unknown as T;
  }

  // Auth
  if (pathname === '/api/auth/login') {
    const res = clientStore.login(body.email, body.password);
    setStoredToken(res.token);
    return res as unknown as T;
  }
  if (pathname === '/api/auth/me') {
    return clientStore.getCurrentUser() as unknown as T;
  }
  if (pathname === '/api/auth/logout') {
    setStoredToken(null);
    return { success: true } as unknown as T;
  }

  // Settings & Reports
  if (pathname === '/api/admin/settings/reset') {
    return clientStore.resetData(body.confirmation) as unknown as T;
  }
  if (pathname === '/api/admin/import/history') {
    return { jobs: [] } as unknown as T;
  }
  if (pathname === '/api/admin/import/reference-dataset') {
    return { success: true, imported: 831, skipped: 0, message: 'Reference dataset loaded.' } as unknown as T;
  }
  if (pathname === '/api/admin/reports/generate') {
    return { success: true, report: { title: 'Executive Summary', generated_at: new Date().toISOString() } } as unknown as T;
  }

  return {} as T;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  // If fallback mode is engaged (e.g. static host without active backend API)
  if (useLocalFallback) {
    try {
      return executeClientFallback<T>(endpoint, options);
    } catch (e) {
      console.warn('[PayNext] Client fallback error:', e);
      throw e;
    }
  }

  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['x-admin-token'] = token;
  }

  const baseUrl = (import.meta as any).env?.VITE_API_URL || '';
  const targetUrl = baseUrl ? `${baseUrl.replace(/\/$/, '')}${endpoint}` : endpoint;

  let response: Response;
  try {
    response = await fetch(targetUrl, {
      ...options,
      headers,
    });
  } catch (netErr) {
    console.warn(`[PayNext] Network error connecting to ${targetUrl}. Activating autonomous client store.`, netErr);
    useLocalFallback = true;
    return executeClientFallback<T>(endpoint, options);
  }

  if (response.status === 401) {
    setStoredToken(null);
  }

  // Read body stream exactly once
  const rawText = await response.text();

  // Detect 404 edge error (like Vercel NOT_FOUND or HTML error page)
  const isHtml404 =
    response.status === 404 ||
    rawText.includes('NOT_FOUND') ||
    rawText.includes('Page not found') ||
    rawText.includes('The page could not be found') ||
    rawText.includes('<!doctype') ||
    rawText.includes('<html');

  if (isHtml404 && !response.ok) {
    console.warn(`[PayNext] Host returned 404 HTML for '${endpoint}' (static deployment mode). Seamlessly activating autonomous client intelligence store.`);
    useLocalFallback = true;
    return executeClientFallback<T>(endpoint, options);
  }

  if (!response.ok) {
    let errorMsg = `Server error (${response.status})`;
    try {
      const errJson = JSON.parse(rawText);
      errorMsg = errJson.error || errJson.message || errorMsg;
    } catch {
      if (rawText && rawText.trim()) {
        errorMsg = rawText.length > 250 ? rawText.substring(0, 250) + '...' : rawText;
      }
    }
    throw new Error(errorMsg);
  }

  if (!rawText || !rawText.trim()) {
    return {} as T;
  }

  try {
    return JSON.parse(rawText) as T;
  } catch {
    return rawText as unknown as T;
  }
}

export const api = {
  // --- Public ---
  getPublicFormConfig: () => request<FormConfig>('/api/public/form-config'),
  submitPublicFeedback: (data: Partial<FeedbackRecord>) =>
    request<{ success: boolean; feedback_id: string; message: string }>('/api/public/feedback', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // --- Auth ---
  login: async (email: string, password: string) => {
    const res = await request<{ token: string; user: AdminUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setStoredToken(res.token);
    return res;
  },
  getCurrentUser: () => request<{ user: AdminUser }>('/api/auth/me'),
  logout: async () => {
    try {
      await request('/api/auth/logout', { method: 'POST' });
    } finally {
      setStoredToken(null);
    }
  },

  // --- Feedback ---
  getFeedback: (params: {
    page?: number;
    limit?: number;
    filters?: GlobalFilterState;
  }) => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));

    const f = params.filters || ({} as GlobalFilterState);
    if (f.country && f.country !== 'all') query.set('country', f.country);
    if (f.city) query.set('city', f.city);
    if (f.channel && f.channel !== 'all') query.set('channel', f.channel);
    if (f.customerSegment && f.customerSegment !== 'all') query.set('customerSegment', f.customerSegment);
    if (f.planTier && f.planTier !== 'all') query.set('planTier', f.planTier);
    if (f.device && f.device !== 'all') query.set('device', f.device);
    if (f.os && f.os !== 'all') query.set('os', f.os);
    if (f.appVersion && f.appVersion !== 'all') query.set('appVersion', f.appVersion);
    if (f.rating !== null && f.rating !== undefined) query.set('rating', String(f.rating));
    if (f.sentiment && f.sentiment !== 'all') query.set('sentiment', f.sentiment);
    if (f.dateRange && f.dateRange !== 'all') query.set('dateRange', f.dateRange);
    if (f.startDate) query.set('startDate', f.startDate);
    if (f.endDate) query.set('endDate', f.endDate);
    if (f.searchQuery) query.set('q', f.searchQuery);

    return request<{
      data: FeedbackWithAnalysis[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/api/admin/feedback?${query.toString()}`);
  },

  getFeedbackDetail: (id: string) =>
    request<{
      feedback: FeedbackRecord;
      analysis: AIAnalysis | null;
      linked_issues: RecurringIssue[];
      linked_requirements: ProductRequirement[];
    }>(`/api/admin/feedback/${id}`),

  // --- CSV Import ---
  previewCsv: (csvData: string) =>
    request<{
      headers: string[];
      totalRows: number;
      sampleRows: any[];
      validationSummary: {
        errorCount: number;
        warningCount: number;
        validRowsEstimate: number;
        issues: any[];
      };
    }>('/api/admin/import/preview', {
      method: 'POST',
      body: JSON.stringify({ csvData }),
    }),

  processCsvImport: (payload: {
    csvData: string;
    mode: 'append' | 'replace';
    columnMapping?: Record<string, string>;
    filename?: string;
  }) =>
    request<{
      success: boolean;
      job: ImportJob;
      summary: {
        totalRows: number;
        imported: number;
        skipped: number;
        rejected: number;
        replaced: number;
      };
    }>('/api/admin/import/process', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  loadReferenceDataset: () =>
    request<{ success: boolean; imported: number; skipped: number; message: string }>(
      '/api/admin/import/reference-dataset',
      { method: 'POST' }
    ),

  getImportHistory: () => request<{ jobs: ImportJob[] }>('/api/admin/import/history'),

  // --- AI Analysis ---
  triggerBatchAnalysis: (batchSize = 10, forceAll = false, feedbackIds?: string[]) =>
    request<{
      success: boolean;
      analyzed_count: number;
      remaining_count: number;
      results: AIAnalysis[];
      message?: string;
    }>('/api/admin/analysis/batch', {
      method: 'POST',
      body: JSON.stringify({ batchSize, forceAll, feedbackIds }),
    }),

  analyzeSingleFeedback: (id: string) =>
    request<{ success: boolean; analysis: AIAnalysis }>(`/api/admin/analysis/single/${id}`, {
      method: 'POST',
    }),

  getAnalysisStats: () =>
    request<{ total: number; completed: number; failed: number; pending: number }>(
      '/api/admin/analysis/stats'
    ),

  // --- Product Insights ---
  getInsights: () => request<{ issues: RecurringIssue[] }>('/api/admin/insights'),
  getInsightDetail: (id: string) =>
    request<{ issue: RecurringIssue; supporting_feedback: FeedbackWithAnalysis[] }>(
      `/api/admin/insights/${id}`
    ),
  synthesizeIssues: () =>
    request<{ success: boolean; issues_count: number; issues: RecurringIssue[] }>(
      '/api/admin/insights/synthesize',
      { method: 'POST' }
    ),

  // --- Requirements ---
  getRequirements: () => request<{ requirements: ProductRequirement[] }>('/api/admin/requirements'),
  generateRequirement: (issue_id: string) =>
    request<{ success: boolean; requirement: ProductRequirement }>('/api/admin/requirements/generate', {
      method: 'POST',
      body: JSON.stringify({ issue_id }),
    }),
  createRequirement: (data: Partial<ProductRequirement>) =>
    request<{ success: boolean; requirement: ProductRequirement }>('/api/admin/requirements', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateRequirement: (id: string, data: Partial<ProductRequirement>) =>
    request<{ success: boolean; requirement: ProductRequirement }>(`/api/admin/requirements/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  reviewRequirement: (id: string, status: string, review_notes?: string) =>
    request<{ success: boolean; requirement: ProductRequirement }>(
      `/api/admin/requirements/${id}/review`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status, review_notes }),
      }
    ),

  // --- Dashboard ---
  getDashboardMetrics: (filters?: GlobalFilterState) => {
    const query = buildFilterQuery(filters);
    return request<DashboardMetrics>(`/api/admin/dashboard/metrics?${query}`);
  },
  getDashboardCharts: (filters?: GlobalFilterState) => {
    const query = buildFilterQuery(filters);
    return request<DashboardChartsData>(`/api/admin/dashboard/charts?${query}`);
  },

  // --- Form Config ---
  getFormConfig: () => request<{ config: FormConfig }>('/api/admin/form-config'),
  updateFormConfig: (config: Partial<FormConfig>) =>
    request<{ success: boolean; config: FormConfig }>('/api/admin/form-config', {
      method: 'PUT',
      body: JSON.stringify(config),
    }),

  // --- Reports & Settings ---
  generateReport: (payload: any) =>
    request<any>('/api/admin/reports/generate', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  resetData: (confirmation: string) =>
    request<{ success: boolean; message: string }>('/api/admin/settings/reset', {
      method: 'POST',
      body: JSON.stringify({ confirmation }),
    }),
};

function buildFilterQuery(filters?: GlobalFilterState): string {
  if (!filters) return '';
  const query = new URLSearchParams();
  if (filters.dateRange && filters.dateRange !== 'all') query.set('dateRange', filters.dateRange);
  if (filters.startDate) query.set('startDate', filters.startDate);
  if (filters.endDate) query.set('endDate', filters.endDate);
  if (filters.country && filters.country !== 'all') query.set('country', filters.country);
  if (filters.city) query.set('city', filters.city);
  if (filters.channel && filters.channel !== 'all') query.set('channel', filters.channel);
  if (filters.customerSegment && filters.customerSegment !== 'all')
    query.set('customerSegment', filters.customerSegment);
  if (filters.planTier && filters.planTier !== 'all') query.set('planTier', filters.planTier);
  if (filters.device && filters.device !== 'all') query.set('device', filters.device);
  if (filters.os && filters.os !== 'all') query.set('os', filters.os);
  if (filters.appVersion && filters.appVersion !== 'all') query.set('appVersion', filters.appVersion);
  if (filters.rating !== null && filters.rating !== undefined)
    query.set('rating', String(filters.rating));
  if (filters.sentiment && filters.sentiment !== 'all') query.set('sentiment', filters.sentiment);
  return query.toString();
}
