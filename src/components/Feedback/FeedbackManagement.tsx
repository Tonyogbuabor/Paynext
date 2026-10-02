import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Eye,
  Sparkles,
  Star,
  Calendar,
  User,
  Mail,
  Smartphone,
  Layers,
  FileCheck2,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowUpDown,
  RefreshCw,
  X,
  ExternalLink,
  MapPin,
  Globe,
} from 'lucide-react';
import { api } from '../../services/api';
import type { FeedbackWithAnalysis, GlobalFilterState, RecurringIssue, ProductRequirement } from '../../types';

interface FeedbackManagementProps {
  initialFilters?: Partial<GlobalFilterState>;
  navigate: (route: string) => void;
}

export const FeedbackManagement: React.FC<FeedbackManagementProps> = ({
  initialFilters,
  navigate,
}) => {
  const [feedbackList, setFeedbackList] = useState<FeedbackWithAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState(initialFilters?.searchQuery || '');
  const [selectedSentiment, setSelectedSentiment] = useState(initialFilters?.sentiment || 'all');
  const [selectedChannel, setSelectedChannel] = useState(initialFilters?.channel || 'all');
  const [selectedCountry, setSelectedCountry] = useState(initialFilters?.country || 'all');

  // Selected Detail Modal
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<{
    feedback: FeedbackWithAnalysis;
    analysis: any;
    linked_issues: RecurringIssue[];
    linked_requirements: ProductRequirement[];
  } | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [analyzingSingle, setAnalyzingSingle] = useState(false);

  const fetchFeedback = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getFeedback({
        page,
        limit,
        filters: {
          searchQuery: searchQuery.trim(),
          sentiment: selectedSentiment as any,
          channel: selectedChannel !== 'all' ? selectedChannel : undefined,
          country: selectedCountry !== 'all' ? selectedCountry : undefined,
          dateRange: 'all',
        },
      });

      setFeedbackList(res.data);
      setTotalPages(res.pagination.totalPages);
      setTotalCount(res.pagination.total);
    } catch (err: any) {
      console.error('Failed to load feedback:', err);
      setError(err.message || 'Error loading feedback records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeedback();
  }, [page, limit, selectedSentiment, selectedChannel, selectedCountry]);

  // Debounced search
  useEffect(() => {
    const handler = setTimeout(() => {
      setPage(1);
      fetchFeedback();
    }, 350);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const openDetail = async (id: string) => {
    try {
      setSelectedId(id);
      setLoadingDetail(true);
      const res = await api.getFeedbackDetail(id);
      setDetailData({
        feedback: res.feedback as any,
        analysis: res.analysis,
        linked_issues: res.linked_issues,
        linked_requirements: res.linked_requirements,
      });
    } catch (err) {
      console.error('Error fetching record detail:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleAnalyzeSingle = async () => {
    if (!selectedId) return;
    try {
      setAnalyzingSingle(true);
      const res = await api.analyzeSingleFeedback(selectedId);
      if (detailData) {
        setDetailData({
          ...detailData,
          analysis: res.analysis,
        });
      }
      // Update in table
      setFeedbackList((prev) =>
        prev.map((item) =>
          item.feedback_id === selectedId ? { ...item, analysis: res.analysis } : item
        )
      );
    } catch (err) {
      console.error('Failed single analysis:', err);
    } finally {
      setAnalyzingSingle(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1F2937] tracking-tight">Feedback Management</h1>
          <p className="text-xs text-gray-500 mt-1">
            Search, filter, and inspect original customer submissions and linked AI intelligence.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchFeedback()}
            className="px-3 py-2 text-xs font-medium text-gray-700 bg-white border border-[#E2E8F0] hover:bg-gray-50 rounded-lg flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#F97316]' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => navigate('/admin/import')}
            className="px-3.5 py-2 text-xs font-medium text-white bg-[#F97316] hover:bg-[#EA580C] rounded-lg flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
          >
            <span>Import CSV</span>
          </button>
        </div>
      </div>

      {/* Quick Sentiment Filter Pills */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => {
            setSelectedSentiment('all');
            setPage(1);
          }}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
            selectedSentiment === 'all'
              ? 'bg-[#1F2937] text-white shadow-2xs'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          <span>All Feedback</span>
        </button>

        <button
          onClick={() => {
            setSelectedSentiment('Negative');
            setPage(1);
          }}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
            selectedSentiment === 'Negative'
              ? 'bg-[#DC2626] text-white shadow-2xs'
              : 'bg-white text-red-600 border border-red-200 hover:bg-red-50'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-red-400"></span>
          <span>Negative Complaints</span>
        </button>

        <button
          onClick={() => {
            setSelectedSentiment('Neutral');
            setPage(1);
          }}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
            selectedSentiment === 'Neutral'
              ? 'bg-slate-700 text-white shadow-2xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-slate-400"></span>
          <span>Neutral Inquiries</span>
        </button>

        <button
          onClick={() => {
            setSelectedSentiment('Positive');
            setPage(1);
          }}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
            selectedSentiment === 'Positive'
              ? 'bg-[#16A34A] text-white shadow-2xs'
              : 'bg-white text-green-700 border border-green-200 hover:bg-green-50'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-green-500"></span>
          <span>Positive Praise</span>
        </button>
      </div>

      {/* Active Sentiment Context Banner */}
      {selectedSentiment === 'Negative' && (
        <div className="bg-red-50 border border-red-200 text-red-800 text-xs px-4 py-2.5 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
            <span className="font-semibold">Negative Feedback Filter Active:</span>
            <span>Displaying customer complaints, unresolved disputes, delayed loan disbursements, transfer failures, and support hold frictions.</span>
          </div>
          <button
            onClick={() => setSelectedSentiment('all')}
            className="text-red-700 underline text-[11px] font-bold hover:text-red-900"
          >
            Clear Filter
          </button>
        </div>
      )}

      {selectedSentiment === 'Neutral' && (
        <div className="bg-slate-50 border border-slate-200 text-slate-800 text-xs px-4 py-2.5 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-slate-500"></span>
            <span className="font-semibold">Neutral / Natural Feedback Filter Active:</span>
            <span>Displaying feature requests, general product inquiries, statement exports, and neutral user comments.</span>
          </div>
          <button
            onClick={() => setSelectedSentiment('all')}
            className="text-slate-700 underline text-[11px] font-bold hover:text-slate-900"
          >
            Clear Filter
          </button>
        </div>
      )}

      {selectedSentiment === 'Positive' && (
        <div className="bg-green-50 border border-green-200 text-green-800 text-xs px-4 py-2.5 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            <span className="font-semibold">Positive Feedback Filter Active:</span>
            <span>Displaying customer praise, speed commendations, and high satisfaction ratings.</span>
          </div>
          <button
            onClick={() => setSelectedSentiment('all')}
            className="text-green-700 underline text-[11px] font-bold hover:text-green-900"
          >
            Clear Filter
          </button>
        </div>
      )}

      {/* Search and Filters Bar */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Search box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search feedback text, ID, customer name, email..."
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-[#1F2937] focus:outline-none focus:ring-1 focus:ring-[#F97316]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sentiment Filter */}
          <div className="w-full sm:w-44">
            <select
              value={selectedSentiment}
              onChange={(e) => {
                setSelectedSentiment(e.target.value as any);
                setPage(1);
              }}
              className="w-full text-xs py-2 px-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#F97316] text-[#1F2937]"
            >
              <option value="all">All Sentiments</option>
              <option value="Positive">Positive</option>
              <option value="Neutral">Neutral</option>
              <option value="Negative">Negative</option>
            </select>
          </div>

          {/* Channel Filter */}
          <div className="w-full sm:w-44">
            <select
              value={selectedChannel}
              onChange={(e) => {
                setSelectedChannel(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs py-2 px-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#F97316] text-[#1F2937]"
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

          {/* Country Filter */}
          <div className="w-full sm:w-44">
            <select
              value={selectedCountry}
              onChange={(e) => {
                setSelectedCountry(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs py-2 px-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#F97316] text-[#1F2937]"
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

        <div className="flex items-center justify-between text-xs text-gray-500 pt-1">
          <span>
            Showing {feedbackList.length} of {totalCount} total feedback records
          </span>
          {(searchQuery || selectedSentiment !== 'all' || selectedChannel !== 'all' || selectedCountry !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedSentiment('all');
                setSelectedChannel('all');
                setSelectedCountry('all');
                setPage(1);
              }}
              className="text-[#F97316] font-medium hover:underline cursor-pointer"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
          {error}
        </div>
      )}

      {/* Main Feedback Table */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Feedback ID</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Channel</th>
                <th className="py-3 px-4">Rating / NPS</th>
                <th className="py-3 px-4">Sentiment</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-gray-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#F97316]" />
                    Loading feedback records...
                  </td>
                </tr>
              ) : feedbackList.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-gray-400">
                    No feedback records match the current criteria.
                  </td>
                </tr>
              ) : (
                feedbackList.map((row) => {
                  const sentiment = row.analysis?.sentiment;
                  const isCompleted = row.analysis?.status === 'Completed';

                  return (
                    <tr
                      key={row.feedback_id}
                      className="hover:bg-gray-50/80 transition-colors group cursor-pointer"
                      onClick={() => openDetail(row.feedback_id)}
                    >
                      <td className="py-3 px-4 font-mono font-semibold text-[#1F2937]">
                        {row.feedback_id}
                      </td>
                      <td className="py-3 px-4 text-gray-500 whitespace-nowrap">
                        {row.submitted_at.substring(0, 10)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-[10px] flex-shrink-0">
                            {(row.customer_name || 'Customer')
                              .split(' ')
                              .filter(Boolean)
                              .map((n) => n[0])
                              .join('')
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-[#1F2937] truncate max-w-[150px]">
                              {row.customer_name || 'Verified Customer'}
                            </div>
                            {row.email && (
                              <div className="text-[11px] text-gray-500 truncate max-w-[150px]">
                                {row.email}
                              </div>
                            )}
                            <div className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                              <span>{row.country}</span>
                              {row.customer_segment && row.customer_segment !== 'Unspecified' && (
                                <>
                                  <span>&bull;</span>
                                  <span className="text-[#F97316] font-medium">{row.customer_segment}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-600 whitespace-nowrap">
                        {row.channel === 'Web Feedback Form' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-semibold">
                            <Globe className="w-3 h-3 text-emerald-600" />
                            Web Form
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded bg-gray-100 text-[11px] font-medium text-gray-700">
                            {row.channel}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {row.rating ? (
                            <span className="inline-flex items-center gap-0.5 text-amber-600 font-bold text-xs">
                              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                              {row.rating}
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                          {row.nps_score !== null && row.nps_score !== undefined && (
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                row.nps_score <= 6
                                  ? 'bg-red-50 text-red-600'
                                  : row.nps_score <= 8
                                  ? 'bg-amber-50 text-amber-600'
                                  : 'bg-green-50 text-green-600'
                              }`}
                            >
                              NPS {row.nps_score}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {sentiment ? (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                              sentiment === 'Positive'
                                ? 'bg-green-50 text-[#16A34A] border border-green-200'
                                : sentiment === 'Negative'
                                ? 'bg-red-50 text-[#DC2626] border border-red-200'
                                : 'bg-slate-50 text-slate-600 border border-slate-200'
                            }`}
                          >
                            {sentiment}
                          </span>
                        ) : (
                          <span className="text-gray-400 italic">Unanalyzed</span>
                        )}
                      </td>
                      <td className="py-3 px-4 max-w-[180px] truncate text-gray-700">
                        {row.analysis?.primary_category || '—'}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {isCompleted ? (
                          <span className="inline-flex items-center gap-1 text-green-600 font-medium text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Completed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-600 font-medium text-[11px]">
                            <Clock className="w-3.5 h-3.5" />
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openDetail(row.feedback_id);
                          }}
                          className="px-2.5 py-1 text-xs text-gray-700 hover:text-[#F97316] bg-gray-50 hover:bg-orange-50 rounded border border-gray-200 transition-colors inline-flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="py-1 px-2 border border-gray-200 rounded text-xs bg-white text-[#1F2937]"
            >
              <option value="10">10</option>
              <option value="15">15</option>
              <option value="25">25</option>
              <option value="50">50</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
            >
              Previous
            </button>
            <span className="font-medium text-[#1F2937]">
              Page {page} of {totalPages || 1}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Detailed Feedback Record Modal / Drawer */}
      {selectedId && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-100 text-[#F97316]">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1F2937] flex items-center gap-2">
                    Feedback Record Details
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-gray-200 text-gray-700">
                      {selectedId}
                    </span>
                  </h3>
                  <p className="text-xs text-gray-500">
                    Source: {detailData?.feedback?.channel} &bull; Recorded on{' '}
                    {detailData?.feedback?.submitted_at}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedId(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {loadingDetail ? (
                <div className="py-12 text-center text-gray-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#F97316]" />
                  Loading feedback data...
                </div>
              ) : detailData ? (
                <>
                  {/* Original Customer Raw Comment */}
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                    <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                      <span>Verbatim Customer Feedback (raw_text)</span>
                      <span className="text-[10px] text-gray-400 font-normal">Original Unedited Text</span>
                    </div>
                    <blockquote className="text-sm font-medium text-[#1F2937] italic leading-relaxed">
                      "{detailData.feedback.raw_text}"
                    </blockquote>
                  </div>

                  {/* Verified Customer Profile Card */}
                  <div className="bg-gradient-to-br from-slate-50 to-orange-50/20 rounded-xl p-5 border border-slate-200 shadow-2xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-4 mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-[#F97316] text-white flex items-center justify-center font-bold text-base shadow-sm">
                          {(detailData.feedback.customer_name || 'Customer')
                            .split(' ')
                            .filter(Boolean)
                            .map((n) => n[0])
                            .join('')
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-[#1F2937]">
                              {detailData.feedback.customer_name || 'Verified Customer'}
                            </h3>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700 border border-green-200">
                              Active Customer
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                            {detailData.feedback.email ? (
                              <a
                                href={`mailto:${detailData.feedback.email}`}
                                className="text-blue-600 hover:underline flex items-center gap-1 font-medium"
                              >
                                <Mail className="w-3 h-3" />
                                <span>{detailData.feedback.email}</span>
                              </a>
                            ) : (
                              <span className="text-gray-400">No email on record</span>
                            )}
                            {detailData.feedback.customer_id && (
                              <>
                                <span>&bull;</span>
                                <span className="font-mono text-[11px] bg-slate-200/70 text-slate-700 px-1.5 py-0.5 rounded">
                                  {detailData.feedback.customer_id}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-orange-100 text-[#F97316] border border-orange-200">
                          {detailData.feedback.customer_segment || 'Retail'} &bull; {detailData.feedback.plan_tier || 'Standard'}
                        </span>
                      </div>
                    </div>

                    {/* Metadata attributes */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="p-2.5 rounded-lg bg-white border border-slate-200/80">
                        <span className="text-gray-400 block text-[10px] uppercase font-semibold">Location</span>
                        <span className="font-bold text-[#1F2937] flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-gray-400" />
                          {detailData.feedback.country} {detailData.feedback.city ? `(${detailData.feedback.city})` : ''}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-white border border-slate-200/80">
                        <span className="text-gray-400 block text-[10px] uppercase font-semibold">Banking Tenure</span>
                        <span className="font-bold text-[#1F2937] mt-0.5 block">
                          {detailData.feedback.account_tenure_months ? `${detailData.feedback.account_tenure_months} Months Account` : 'Standard Customer'}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-white border border-slate-200/80">
                        <span className="text-gray-400 block text-[10px] uppercase font-semibold">Source Channel</span>
                        <span className="font-semibold text-gray-800 mt-0.5 block truncate">
                          {detailData.feedback.channel}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-white border border-slate-200/80">
                        <span className="text-gray-400 block text-[10px] uppercase font-semibold">Device & Environment</span>
                        <span className="font-medium text-gray-700 mt-0.5 block truncate" title={`${detailData.feedback.device || 'Web'} (${detailData.feedback.os || 'OS'})`}>
                          {detailData.feedback.device || 'Web'} &bull; {detailData.feedback.os || 'OS'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* AI Analysis Section */}
                  <div className="border-t border-gray-100 pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-[#F97316]" />
                        <h4 className="text-sm font-bold text-[#1F2937]">Gemini AI Feedback Intelligence</h4>
                      </div>
                      <button
                        onClick={handleAnalyzeSingle}
                        disabled={analyzingSingle}
                        className="px-3 py-1 text-xs font-semibold bg-orange-50 text-[#F97316] hover:bg-orange-100 rounded border border-orange-200 transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className={`w-3 h-3 ${analyzingSingle ? 'animate-spin' : ''}`} />
                        <span>{detailData.analysis ? 'Re-Analyze with Gemini' : 'Analyze Now'}</span>
                      </button>
                    </div>

                    {detailData.analysis ? (
                      <div className="space-y-3 bg-orange-50/30 rounded-xl p-4 border border-orange-100">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                          <div>
                            <span className="text-gray-400 block text-[10px] uppercase">Sentiment</span>
                            <span className="font-bold text-[#1F2937]">{detailData.analysis.sentiment}</span>
                          </div>
                          <div>
                            <span className="text-gray-400 block text-[10px] uppercase">Primary Category</span>
                            <span className="font-bold text-[#1F2937]">{detailData.analysis.primary_category}</span>
                          </div>
                          <div>
                            <span className="text-gray-400 block text-[10px] uppercase">Urgency</span>
                            <span className="font-bold text-red-600">{detailData.analysis.urgency}</span>
                          </div>
                          <div>
                            <span className="text-gray-400 block text-[10px] uppercase">Product Area</span>
                            <span className="font-bold text-[#1F2937]">{detailData.analysis.product_area}</span>
                          </div>
                        </div>

                        <div className="text-xs pt-2">
                          <span className="font-semibold text-gray-700 block mb-0.5">Problem Summary:</span>
                          <p className="text-gray-800 bg-white p-2.5 rounded-lg border border-orange-200/50">
                            {detailData.analysis.summary}
                          </p>
                        </div>

                        <div className="text-xs">
                          <span className="font-semibold text-gray-700 block mb-0.5">Customer Pain Point:</span>
                          <p className="text-gray-800 bg-white p-2.5 rounded-lg border border-orange-200/50">
                            {detailData.analysis.customer_pain_point}
                          </p>
                        </div>

                        <div className="text-xs">
                          <span className="font-semibold text-gray-700 block mb-0.5">Extracted Evidence:</span>
                          <p className="text-gray-600 bg-white p-2.5 rounded-lg border border-orange-200/50 italic">
                            "{detailData.analysis.evidence}"
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="p-6 text-center text-xs text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                        This feedback has not yet been processed by Gemini AI. Click "Analyze Now" to generate structured sentiment, categorization, and evidence extraction.
                      </div>
                    )}
                  </div>

                  {/* Linked Issues & Requirements */}
                  {detailData.linked_issues.length > 0 && (
                    <div className="border-t border-gray-100 pt-4">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                        Linked Recurring Customer Issues
                      </h4>
                      <div className="space-y-2">
                        {detailData.linked_issues.map((iss) => (
                          <div
                            key={iss.id}
                            onClick={() => {
                              setSelectedId(null);
                              navigate('/admin/insights');
                            }}
                            className="p-3 rounded-lg border border-gray-200 hover:border-[#F97316] bg-gray-50 hover:bg-orange-50/30 transition-all cursor-pointer flex items-center justify-between"
                          >
                            <div>
                              <div className="font-bold text-xs text-[#1F2937]">{iss.title}</div>
                              <div className="text-[11px] text-gray-500">{iss.description}</div>
                            </div>
                            <ExternalLink className="w-4 h-4 text-gray-400" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-end">
              <button
                onClick={() => setSelectedId(null)}
                className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
