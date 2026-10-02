import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Star,
  Users,
  AlertTriangle,
  RefreshCw,
  Filter,
  CheckCircle2,
  PieChart,
  BarChart3,
  Calendar,
  Globe,
  Smartphone,
  Layers,
  ChevronRight,
  ArrowUpRight,
  ShieldCheck,
  CreditCard,
  Building,
} from 'lucide-react';
import { api } from '../../services/api';
import type { DashboardMetrics, DashboardChartsData, GlobalFilterState } from '../../types';

interface OverviewDashboardProps {
  navigate: (route: string) => void;
  onFilterDrilldown?: (filters: Partial<GlobalFilterState>) => void;
}

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({
  navigate,
  onFilterDrilldown,
}) => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [charts, setCharts] = useState<DashboardChartsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [filters, setFilters] = useState<GlobalFilterState>({
    dateRange: 'all',
    country: 'all',
    channel: 'all',
    customerSegment: 'all',
    planTier: 'all',
    rating: null,
    sentiment: 'all',
  });

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [mRes, cRes] = await Promise.all([
        api.getDashboardMetrics(filters),
        api.getDashboardCharts(filters),
      ]);
      setMetrics(mRes);
      setCharts(cRes);
    } catch (err: any) {
      console.error('Failed to load dashboard:', err);
      setError(err.message || 'Error computing dashboard analytics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [filters]);

  const handleDrilldown = (newFilter: Partial<GlobalFilterState>) => {
    if (onFilterDrilldown) {
      onFilterDrilldown(newFilter);
    }
    navigate('/admin/feedback');
  };

  const resetFilters = () => {
    setFilters({
      dateRange: 'all',
      country: 'all',
      channel: 'all',
      customerSegment: 'all',
      planTier: 'all',
      rating: null,
      sentiment: 'all',
    });
  };

  const hasActiveFilters =
    filters.dateRange !== 'all' ||
    filters.country !== 'all' ||
    filters.channel !== 'all' ||
    filters.customerSegment !== 'all' ||
    filters.planTier !== 'all' ||
    filters.rating !== null ||
    filters.sentiment !== 'all';

  return (
    <div className="space-y-6">
      {/* Title & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1F2937] tracking-tight">Executive Intelligence Dashboard</h1>
          <p className="text-xs text-gray-500 mt-1">
            Real-time customer feedback analytics, recurring issue discovery, and satisfaction signals.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadDashboardData()}
            className="px-3 py-2 text-xs font-medium text-gray-700 bg-white border border-[#E2E8F0] hover:bg-gray-50 rounded-lg flex items-center gap-1.5 transition-colors shadow-2xs"
            title="Refresh metrics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#F97316]' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => navigate('/admin/analysis')}
            className="px-3.5 py-2 text-xs font-medium text-white bg-[#F97316] hover:bg-[#EA580C] rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Batch Analysis</span>
          </button>
        </div>
      </div>

      {/* Global Interactive Filter Bar */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-2xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-600">
            <Filter className="w-3.5 h-3.5 text-[#F97316]" />
            <span>Interactive Data Filters</span>
            {hasActiveFilters && (
              <span className="bg-orange-100 text-[#F97316] text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                Active
              </span>
            )}
          </div>
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="text-xs text-[#F97316] hover:underline font-medium cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2.5">
          {/* Date Range */}
          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-1">Timeframe</label>
            <select
              value={filters.dateRange}
              onChange={(e) => setFilters({ ...filters, dateRange: e.target.value as any })}
              className="w-full text-xs py-1.5 px-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#F97316] text-[#1F2937]"
            >
              <option value="all">All Time</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
            </select>
          </div>

          {/* Sentiment */}
          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-1">Sentiment</label>
            <select
              value={filters.sentiment || 'all'}
              onChange={(e) => setFilters({ ...filters, sentiment: e.target.value as any })}
              className="w-full text-xs py-1.5 px-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#F97316] text-[#1F2937]"
            >
              <option value="all">All Sentiments</option>
              <option value="Positive">Positive</option>
              <option value="Neutral">Neutral</option>
              <option value="Negative">Negative</option>
            </select>
          </div>

          {/* Rating */}
          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-1">Rating</label>
            <select
              value={filters.rating === null ? 'all' : String(filters.rating)}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  rating: e.target.value === 'all' ? null : Number(e.target.value),
                })
              }
              className="w-full text-xs py-1.5 px-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#F97316] text-[#1F2937]"
            >
              <option value="all">All Ratings</option>
              <option value="5">5 Stars</option>
              <option value="4">4 Stars</option>
              <option value="3">3 Stars</option>
              <option value="2">2 Stars</option>
              <option value="1">1 Star</option>
            </select>
          </div>

          {/* Channel */}
          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-1">Channel</label>
            <select
              value={filters.channel || 'all'}
              onChange={(e) => setFilters({ ...filters, channel: e.target.value })}
              className="w-full text-xs py-1.5 px-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#F97316] text-[#1F2937]"
            >
              <option value="all">All Channels</option>
              <option value="Customer Interview">Customer Interview</option>
              <option value="Email">Email</option>
              <option value="Google Play Review">Google Play Review</option>
              <option value="App Store Review">App Store Review</option>
              <option value="Support Ticket">Support Ticket</option>
              <option value="NPS Survey">NPS Survey</option>
              <option value="X (Twitter)">X (Twitter)</option>
              <option value="Web Feedback Form">Web Feedback Form</option>
            </select>
          </div>

          {/* Customer Segment */}
          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-1">Segment</label>
            <select
              value={filters.customerSegment || 'all'}
              onChange={(e) => setFilters({ ...filters, customerSegment: e.target.value })}
              className="w-full text-xs py-1.5 px-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#F97316] text-[#1F2937]"
            >
              <option value="all">All Segments</option>
              <option value="Retail">Retail</option>
              <option value="Student">Student</option>
              <option value="SME">SME</option>
              <option value="Premium">Premium</option>
            </select>
          </div>

          {/* Plan Tier */}
          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-1">Plan Tier</label>
            <select
              value={filters.planTier || 'all'}
              onChange={(e) => setFilters({ ...filters, planTier: e.target.value })}
              className="w-full text-xs py-1.5 px-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#F97316] text-[#1F2937]"
            >
              <option value="all">All Tiers</option>
              <option value="Basic">Basic</option>
              <option value="Plus">Plus</option>
              <option value="Premium">Premium</option>
              <option value="Business">Business</option>
            </select>
          </div>

          {/* Country */}
          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-1">Country</label>
            <select
              value={filters.country || 'all'}
              onChange={(e) => setFilters({ ...filters, country: e.target.value })}
              className="w-full text-xs py-1.5 px-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#F97316] text-[#1F2937]"
            >
              <option value="all">All Countries</option>
              <option value="Nigeria">Nigeria</option>
              <option value="Kenya">Kenya</option>
              <option value="Ghana">Ghana</option>
              <option value="South Africa">South Africa</option>
              <option value="United Kingdom">United Kingdom</option>
              <option value="United States">United States</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={loadDashboardData} className="underline font-semibold">
            Retry
          </button>
        </div>
      )}

      {/* 6 Key Performance Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* 1. Total Feedback */}
        <div
          onClick={() => handleDrilldown({})}
          className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-2xs hover:border-[#F97316] transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Total Feedback</span>
            <div className="p-1.5 rounded-lg bg-orange-50 text-[#F97316] group-hover:bg-[#F97316] group-hover:text-white transition-colors">
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-[#1F2937] tracking-tight">
            {metrics ? metrics.totalFeedback.toLocaleString() : '—'}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-2">
            <span>{metrics?.analyzedCount || 0} analyzed</span>
            <span>&bull;</span>
            <span className="text-[#F97316] font-medium">{metrics?.pendingAnalysisCount || 0} pending</span>
          </div>
        </div>

        {/* 2. New Feedback (Last 30 Days) */}
        <div
          onClick={() => handleDrilldown({ dateRange: '30d' })}
          className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-2xs hover:border-[#F97316] transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">New (30 Days)</span>
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-[#1F2937] tracking-tight">
            {metrics ? metrics.newFeedbackCount.toLocaleString() : '—'}
          </div>
          <div className="flex items-center gap-1 text-xs text-green-600 mt-2 font-medium">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Active ingestion</span>
          </div>
        </div>

        {/* 3. Average Rating */}
        <div
          onClick={() => handleDrilldown({})}
          className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-2xs hover:border-[#F97316] transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Avg Rating</span>
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-500 group-hover:bg-amber-500 group-hover:text-white transition-colors">
              <Star className="w-4 h-4 fill-amber-500" />
            </div>
          </div>
          <div className="text-2xl font-bold text-[#1F2937] tracking-tight flex items-baseline gap-1">
            {metrics?.averageRating !== null && metrics?.averageRating !== undefined ? (
              <>
                <span>{metrics.averageRating}</span>
                <span className="text-xs font-normal text-gray-400">/ 5.0</span>
              </>
            ) : (
              <span className="text-sm font-normal text-gray-400">No ratings yet</span>
            )}
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-500 mt-2">
            <span>Customer satisfaction</span>
          </div>
        </div>

        {/* 4. Negative Feedback % */}
        <div
          onClick={() => handleDrilldown({ sentiment: 'Negative' })}
          className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-2xs hover:border-[#DC2626] transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Negative %</span>
            <div className="p-1.5 rounded-lg bg-red-50 text-[#DC2626] group-hover:bg-[#DC2626] group-hover:text-white transition-colors">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-[#DC2626] tracking-tight">
            {metrics ? `${metrics.negativeFeedbackPercentage}%` : '—'}
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-500 mt-2">
            <span>Complaints & friction</span>
          </div>
        </div>

        {/* 5. Net Promoter Score */}
        <div
          onClick={() => handleDrilldown({})}
          className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-2xs hover:border-[#16A34A] transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Avg NPS Score</span>
            <div className="p-1.5 rounded-lg bg-green-50 text-[#16A34A] group-hover:bg-[#16A34A] group-hover:text-white transition-colors">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-[#1F2937] tracking-tight">
            {metrics?.averageNps !== null && metrics?.averageNps !== undefined
              ? (metrics.averageNps > 0 ? `+${metrics.averageNps}` : metrics.averageNps)
              : 'N/A'}
          </div>
          <div className="text-[11px] text-gray-500 mt-2 flex items-center justify-between">
            <span className="text-green-600 font-medium">{metrics?.npsPromotersPercentage || 0}% Pro</span>
            <span className="text-gray-400">{metrics?.npsPassivesPercentage || 0}% Pas</span>
            <span className="text-red-600 font-medium">{metrics?.npsDetractorsPercentage || 0}% Det</span>
          </div>
        </div>

        {/* 6. Recurring Issues Identified */}
        <div
          onClick={() => navigate('/admin/insights')}
          className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-2xs hover:border-[#F97316] transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Recurring Issues</span>
            <div className="p-1.5 rounded-lg bg-amber-50 text-[#D97706] group-hover:bg-[#D97706] group-hover:text-white transition-colors">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-[#1F2937] tracking-tight">
            {metrics ? metrics.recurringIssuesCount : '—'}
          </div>
          <div className="flex items-center gap-1 text-xs text-[#F97316] font-medium mt-2">
            <span>View in Insights</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>

      {/* Row 1: Volume Over Time & Sentiment Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 1. Volume Over Time Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-[#1F2937]">Feedback Volume Over Time</h3>
              <p className="text-xs text-gray-500">Chronological distribution with negative complaint overlay</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-[#F97316]"></span>
                <span className="text-gray-600">Total Feedback</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-red-500"></span>
                <span className="text-gray-600">Negative Feedback</span>
              </div>
            </div>
          </div>

          {charts && charts.volumeOverTime.length > 0 ? (
            <div className="pt-4">
              <div className="h-56 flex items-end gap-2 sm:gap-3 px-2 border-b border-gray-200">
                {charts.volumeOverTime.slice(-12).map((item, idx) => {
                  const maxVal = Math.max(...charts.volumeOverTime.map((v) => v.count), 1);
                  const totalHeight = Math.max(12, Math.round((item.count / maxVal) * 100));
                  const negHeight = Math.round((item.negativeCount / maxVal) * 100);

                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                      {/* Tooltip */}
                      <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-[#1F2937] text-white text-[10px] rounded px-2 py-1 pointer-events-none whitespace-nowrap z-10">
                        {item.date}: {item.count} total, {item.negativeCount} negative
                      </div>

                      {/* Bar Stack */}
                      <div
                        style={{ height: `${totalHeight}%` }}
                        className="w-full max-w-[28px] bg-orange-200 rounded-t flex flex-col justify-end overflow-hidden group-hover:bg-orange-300 transition-colors"
                      >
                        {negHeight > 0 && (
                          <div
                            style={{ height: `${(negHeight / totalHeight) * 100}%` }}
                            className="w-full bg-red-500/90"
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between text-[11px] text-gray-400 mt-2 px-1">
                {charts.volumeOverTime.slice(-12).map((item, idx) => (
                  <span key={idx} className="truncate max-w-[45px]">
                    {item.date.slice(5)}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-xs text-gray-400">
              No historical volume recorded yet
            </div>
          )}
        </div>

        {/* 2. Sentiment Distribution */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#1F2937]">Customer Sentiment Breakdown</h3>
            <p className="text-xs text-gray-500 mb-4">Classified via Gemini AI models</p>

            {charts && (
              <div className="space-y-4">
                {/* Positive */}
                <div
                  onClick={() => handleDrilldown({ sentiment: 'Positive' })}
                  className="cursor-pointer group p-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex justify-between text-xs font-medium mb-1">
                    <span className="flex items-center gap-1.5 text-green-700">
                      <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>
                      Positive
                    </span>
                    <span className="font-bold text-[#1F2937]">
                      {charts.sentimentDistribution.positive} records
                    </span>
                  </div>
                  <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div
                      style={{
                        width: `${
                          (charts.sentimentDistribution.positive /
                            (metrics?.analyzedCount || 1)) *
                          100
                        }%`,
                      }}
                      className="h-full bg-green-500 rounded-full"
                    />
                  </div>
                </div>

                {/* Neutral */}
                <div
                  onClick={() => handleDrilldown({ sentiment: 'Neutral' })}
                  className="cursor-pointer group p-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex justify-between text-xs font-medium mb-1">
                    <span className="flex items-center gap-1.5 text-gray-600">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
                      Neutral
                    </span>
                    <span className="font-bold text-[#1F2937]">
                      {charts.sentimentDistribution.neutral} records
                    </span>
                  </div>
                  <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div
                      style={{
                        width: `${
                          (charts.sentimentDistribution.neutral /
                            (metrics?.analyzedCount || 1)) *
                          100
                        }%`,
                      }}
                      className="h-full bg-slate-400 rounded-full"
                    />
                  </div>
                </div>

                {/* Negative */}
                <div
                  onClick={() => handleDrilldown({ sentiment: 'Negative' })}
                  className="cursor-pointer group p-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex justify-between text-xs font-medium mb-1">
                    <span className="flex items-center gap-1.5 text-red-600">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                      Negative
                    </span>
                    <span className="font-bold text-[#1F2937]">
                      {charts.sentimentDistribution.negative} records
                    </span>
                  </div>
                  <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div
                      style={{
                        width: `${
                          (charts.sentimentDistribution.negative /
                            (metrics?.analyzedCount || 1)) *
                          100
                        }%`,
                      }}
                      className="h-full bg-red-500 rounded-full"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span>Analyzed: {metrics?.analyzedCount || 0} of {metrics?.totalFeedback || 0}</span>
            <button
              onClick={() => navigate('/admin/analysis')}
              className="text-[#F97316] font-medium hover:underline flex items-center gap-1"
            >
              Analyze Batch <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Row 2: Most Frequently Reported Issues & Channel Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 3. Top Reported Categories */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-[#1F2937]">Top Reported Issue Categories</h3>
              <p className="text-xs text-gray-500">Click any category bar to inspect matching comments</p>
            </div>
            <button
              onClick={() => navigate('/admin/insights')}
              className="text-xs text-[#F97316] font-medium hover:underline flex items-center gap-1"
            >
              View Synthesized Issues <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {charts && charts.topCategories.length > 0 ? (
            <div className="space-y-3">
              {charts.topCategories.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => handleDrilldown({})}
                  className="p-2 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer group"
                >
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-[#1F2937] group-hover:text-[#F97316] transition-colors truncate max-w-[280px]">
                      {item.category}
                    </span>
                    <span className="text-gray-500 font-semibold">{item.count} reports ({item.percentage}%)</span>
                  </div>
                  <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${Math.max(5, item.percentage)}%` }}
                      className="h-full bg-[#F97316] rounded-full transition-all"
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center text-xs text-gray-400">
              Run AI Analysis to classify categories
            </div>
          )}
        </div>

        {/* 4. Feedback by Channel & Average Channel Rating */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-[#1F2937]">Feedback by Channel</h3>
              <p className="text-xs text-gray-500">Volume and customer satisfaction score by intake point</p>
            </div>
          </div>

          {charts && charts.channelDistribution.length > 0 ? (
            <div className="space-y-3">
              {charts.channelDistribution.map((ch, idx) => (
                <div
                  key={idx}
                  onClick={() => handleDrilldown({ channel: ch.channel })}
                  className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-[#F97316] bg-gray-50/50 hover:bg-white transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-orange-100 text-[#F97316] flex items-center justify-center text-xs font-bold">
                      {ch.channel.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[#1F2937]">{ch.channel}</h4>
                      <p className="text-[11px] text-gray-500">{ch.count} submissions</p>
                    </div>
                  </div>

                  <div className="text-right">
                    {ch.avgRating !== null ? (
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-bold border border-amber-200">
                        <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                        <span>{ch.avgRating} / 5.0</span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">No ratings</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center text-xs text-gray-400">
              No channel data available
            </div>
          )}
        </div>
      </div>

      {/* Row 3: Geographical Distribution & Emerging Complaints */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 6. Feedback by Country */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-[#1F2937]">Feedback by Country</h3>
              <p className="text-xs text-gray-500">Top geographic jurisdictions</p>
            </div>
            <Globe className="w-4 h-4 text-gray-400" />
          </div>

          {charts && charts.countryDistribution.length > 0 ? (
            <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
              {charts.countryDistribution.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => handleDrilldown({ country: item.country })}
                  className="flex items-center justify-between text-xs p-2 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <span className="font-medium text-gray-700 truncate">{item.country}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#1F2937]">{item.count}</span>
                    <span className="text-[10px] text-gray-400">reports</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center text-xs text-gray-400">
              No geographical data
            </div>
          )}
        </div>

        {/* 7. Segment & Plan Tier */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-[#1F2937]">Segment & Plan Matrix</h3>
              <p className="text-xs text-gray-500">User profiles reporting issues</p>
            </div>
            <Users className="w-4 h-4 text-gray-400" />
          </div>

          {charts && charts.segmentAndTier.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {charts.segmentAndTier.map((st, idx) => (
                <div
                  key={idx}
                  onClick={() => handleDrilldown({ customerSegment: st.segment, planTier: st.tier })}
                  className="flex items-center justify-between text-xs p-2 rounded-lg bg-gray-50 hover:bg-orange-50/50 hover:border-orange-200 border border-transparent transition-all cursor-pointer"
                >
                  <div>
                    <span className="font-bold text-[#1F2937]">{st.segment}</span>
                    <span className="text-gray-400 mx-1.5">&bull;</span>
                    <span className="text-gray-600 font-medium">{st.tier}</span>
                  </div>
                  <span className="font-bold text-[#F97316]">{st.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center text-xs text-gray-400">
              No segment data
            </div>
          )}
        </div>

        {/* 10. Emerging Complaints & Trend Signals */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-[#1F2937]">Emerging Complaints</h3>
              <p className="text-xs text-gray-500">Velocity change in negative reports</p>
            </div>
            <TrendingUp className="w-4 h-4 text-red-500" />
          </div>

          {charts && charts.emergingComplaints.length > 0 ? (
            <div className="space-y-2.5">
              {charts.emergingComplaints.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => navigate('/admin/insights')}
                  className="p-2.5 rounded-lg border border-gray-100 hover:border-gray-200 bg-gray-50/40 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-[#1F2937] truncate max-w-[160px]">{item.topic}</span>
                    <span
                      className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${
                        item.changePercent > 0
                          ? 'bg-red-50 text-red-700'
                          : 'bg-green-50 text-green-700'
                      }`}
                    >
                      {item.changePercent > 0 ? `+${item.changePercent}%` : `${item.changePercent}%`}
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-500 flex items-center justify-between">
                    <span>{item.recentCount} recent occurrences</span>
                    <span className="text-[#F97316] font-medium capitalize">{item.trend}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center text-xs text-gray-400">
              No complaint spikes detected
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
