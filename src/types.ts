export interface FeedbackRecord {
  feedback_id: string;
  customer_id?: string;
  customer_name?: string;
  email?: string;
  country: string;
  city?: string;
  customer_segment?: string;
  plan_tier?: string;
  account_tenure_months?: number | null;
  channel: string;
  source_reference?: string;
  submitted_at: string;
  rating?: number | null;
  nps_score?: number | null;
  device?: string;
  os?: string;
  app_version?: string;
  raw_text: string;
  created_at: string;
  source: 'csv' | 'web_form' | 'manual';
}

export type UrgencyLevel = 'Critical' | 'High' | 'Medium' | 'Low';
export type SentimentType = 'Positive' | 'Neutral' | 'Negative';
export type AnalysisStatus = 'Pending' | 'Processing' | 'Completed' | 'Failed';

export interface AIAnalysis {
  id: string;
  feedback_id: string;
  sentiment: SentimentType;
  primary_category: string;
  secondary_category?: string | null;
  summary: string;
  product_area: string;
  customer_pain_point: string;
  urgency: UrgencyLevel;
  evidence: string;
  confidence: 'High' | 'Medium' | 'Low' | number;
  is_unclear: boolean;
  unclear_reason?: string | null;
  status: AnalysisStatus;
  error_message?: string | null;
  analyzed_at?: string | null;
}

export interface FeedbackWithAnalysis extends FeedbackRecord {
  analysis?: AIAnalysis | null;
}

export interface RecurringIssue {
  id: string;
  title: string;
  description: string;
  product_area: string;
  primary_category: string;
  supporting_feedback_ids: string[];
  feedback_count: number;
  distinct_customers_count: number;
  sentiment_breakdown: {
    positive: number;
    neutral: number;
    negative: number;
  };
  segments: string[];
  plan_tiers: string[];
  countries: string[];
  channels: string[];
  devices: string[];
  app_versions: string[];
  trend: 'increasing' | 'stable' | 'decreasing' | 'emerging';
  trend_percentage?: number;
  representative_comments: string[];
  confidence: 'High' | 'Medium' | 'Low';
  created_at: string;
  updated_at: string;
}

export type RequirementPriority = 'Critical' | 'High' | 'Medium' | 'Low';
export type RequirementReviewStatus =
  | 'Draft'
  | 'Approved'
  | 'Rejected'
  | 'Needs Investigation'
  | 'Revision Requested';

export interface ProductRequirement {
  id: string;
  issue_id?: string | null;
  title: string;
  problem_statement: string;
  evidence_summary: string;
  affected_customer_groups: string;
  proposed_solution: string;
  user_story: string; // "As a [type of user], I want [capability], so that [benefit]."
  acceptance_criteria: string[];
  priority: RequirementPriority;
  priority_rationale: string;
  supporting_feedback_ids: string[];
  review_status: RequirementReviewStatus;
  review_notes?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'superadmin' | 'product_manager' | 'analyst';
  created_at: string;
}

export interface FormConfig {
  title: string;
  description: string;
  accent_color: string;
  enable_ratings: boolean;
  enable_nps: boolean;
  enable_device_info: boolean;
  enable_customer_name: boolean;
  enable_email: boolean;
  custom_privacy_note: string;
  submission_count: number;
}

export interface ImportValidationIssue {
  row: number;
  field: string;
  message: string;
  feedback_id?: string;
  severity: 'error' | 'warning';
}

export interface ImportJob {
  id: string;
  filename: string;
  imported_at: string;
  total_rows: number;
  imported_count: number;
  skipped_count: number;
  rejected_count: number;
  validation_issues: ImportValidationIssue[];
}

export interface DashboardMetrics {
  totalFeedback: number;
  newFeedbackCount: number; // e.g. last 30 days
  averageRating: number | null;
  negativeFeedbackPercentage: number;
  averageNps: number | null;
  npsPromotersPercentage: number;
  npsPassivesPercentage: number;
  npsDetractorsPercentage: number;
  recurringIssuesCount: number;
  analyzedCount: number;
  pendingAnalysisCount: number;
}

export interface DashboardChartsData {
  volumeOverTime: Array<{ date: string; count: number; negativeCount: number }>;
  sentimentDistribution: { positive: number; neutral: number; negative: number };
  topCategories: Array<{ category: string; count: number; percentage: number }>;
  channelDistribution: Array<{ channel: string; count: number; avgRating: number | null }>;
  countryDistribution: Array<{ country: string; count: number }>;
  segmentAndTier: Array<{ segment: string; tier: string; count: number }>;
  deviceAndAppVersion: Array<{ item: string; count: number }>;
  npsDistribution: { detractors: number; passives: number; promoters: number };
  emergingComplaints: Array<{ topic: string; recentCount: number; changePercent: number; trend: string }>;
}

export interface GlobalFilterState {
  dateRange: 'all' | '7d' | '30d' | '90d' | 'custom';
  startDate?: string;
  endDate?: string;
  country?: string;
  city?: string;
  channel?: string;
  customerSegment?: string;
  planTier?: string;
  device?: string;
  os?: string;
  appVersion?: string;
  rating?: number | null;
  sentiment?: SentimentType | 'all';
  searchQuery?: string;
}
