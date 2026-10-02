import React, { useState, useEffect } from 'react';
import {
  Lightbulb,
  Sparkles,
  Layers,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Users,
  Globe,
  Smartphone,
  ExternalLink,
  MessageSquare,
  FileCheck2,
  RefreshCw,
  Eye,
  X,
  AlertTriangle,
} from 'lucide-react';
import { api } from '../../services/api';
import type { RecurringIssue, FeedbackWithAnalysis } from '../../types';

interface ProductInsightsWorkspaceProps {
  navigate: (route: string) => void;
  onSelectIssueForRequirement?: (issue: RecurringIssue) => void;
}

export const ProductInsightsWorkspace: React.FC<ProductInsightsWorkspaceProps> = ({
  navigate,
  onSelectIssueForRequirement,
}) => {
  const [issues, setIssues] = useState<RecurringIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [synthesizing, setSynthesizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal inspection of supporting comments
  const [activeIssue, setActiveIssue] = useState<RecurringIssue | null>(null);
  const [supportingFeedback, setSupportingFeedback] = useState<FeedbackWithAnalysis[]>([]);
  const [loadingSupporting, setLoadingSupporting] = useState(false);

  const loadIssues = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getInsights();
      setIssues(res.issues);
    } catch (err: any) {
      console.error('Failed to load issues:', err);
      setError(err.message || 'Error fetching recurring issues.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIssues();
  }, []);

  const handleSynthesize = async () => {
    try {
      setSynthesizing(true);
      setError(null);
      const res = await api.synthesizeIssues();
      setIssues(res.issues);
    } catch (err: any) {
      console.error('Synthesis error:', err);
      setError(err.message || 'Failed to synthesize recurring issues.');
    } finally {
      setSynthesizing(false);
    }
  };

  const openSupportingModal = async (issue: RecurringIssue) => {
    try {
      setActiveIssue(issue);
      setLoadingSupporting(true);
      const res = await api.getInsightDetail(issue.id);
      setSupportingFeedback(res.supporting_feedback);
    } catch (err) {
      console.error('Error fetching supporting comments:', err);
    } finally {
      setLoadingSupporting(false);
    }
  };

  const handleConvertToRequirement = (issue: RecurringIssue) => {
    if (onSelectIssueForRequirement) {
      onSelectIssueForRequirement(issue);
    }
    navigate('/admin/requirements');
  };

  return (
    <div className="space-y-6">
      {/* Header & Synthesis trigger */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1F2937] tracking-tight flex items-center gap-2">
            <Lightbulb className="w-6 h-6 text-[#F97316]" />
            Recurring Customer Problems & Product Insights
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Gemini semantic clustering across customer complaints to identify root causes and evidence-backed problem statements.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSynthesize}
            disabled={synthesizing}
            className="px-4 py-2 text-xs font-semibold bg-[#F97316] hover:bg-[#EA580C] text-white rounded-lg transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
          >
            <Sparkles className={`w-3.5 h-3.5 ${synthesizing ? 'animate-spin' : ''}`} />
            <span>{synthesizing ? 'Synthesizing with Gemini...' : 'Synthesize Issues with AI'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
          {error}
        </div>
      )}

      {/* Issues Grid */}
      {loading ? (
        <div className="py-16 text-center text-gray-400 bg-white rounded-2xl border border-gray-200">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#F97316]" />
          Analyzing feedback clusters...
        </div>
      ) : issues.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-12 text-center max-w-xl mx-auto shadow-2xs">
          <div className="w-12 h-12 rounded-2xl bg-orange-50 text-[#F97316] flex items-center justify-center mx-auto mb-3">
            <Layers className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-[#1F2937] mb-1">No Recurring Issues Synthesized Yet</h3>
          <p className="text-xs text-gray-500 mb-6">
            Click "Synthesize Issues with AI" to let Gemini analyze all processed customer comments and group them into actionable problem clusters.
          </p>
          <button
            onClick={handleSynthesize}
            disabled={synthesizing}
            className="px-5 py-2.5 bg-[#F97316] hover:bg-[#EA580C] text-white text-xs font-semibold rounded-xl transition-colors shadow-sm inline-flex items-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Discover Recurring Problems Now</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {issues.map((issue) => (
            <div
              key={issue.id}
              className="bg-white rounded-2xl border border-[#E2E8F0] hover:border-[#F97316] p-6 shadow-2xs space-y-4 transition-all flex flex-col justify-between"
            >
              <div>
                {/* Header Tag Bar */}
                <div className="flex items-center justify-between text-xs mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#F97316] bg-orange-50 px-2 py-0.5 rounded border border-orange-200">
                      {issue.primary_category}
                    </span>
                    <span className="text-gray-400">&bull;</span>
                    <span className="text-gray-500 font-medium">{issue.product_area}</span>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded capitalize ${
                      issue.trend === 'increasing'
                        ? 'bg-red-50 text-red-700 border border-red-200'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    <TrendingUp className="w-3 h-3 text-red-600" />
                    {issue.trend} trend
                  </span>
                </div>

                {/* Title & Description */}
                <h3 className="text-base font-bold text-[#1F2937] mb-2 leading-snug">{issue.title}</h3>
                <p className="text-xs text-gray-600 leading-relaxed mb-4">{issue.description}</p>

                {/* Supporting Metrics Strip */}
                <div className="grid grid-cols-3 gap-2 p-3 bg-gray-50 rounded-xl border border-gray-100 text-center mb-4">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-400 block">Total Reports</span>
                    <span className="text-base font-bold text-[#1F2937]">{issue.feedback_count}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-400 block">Unique Users</span>
                    <span className="text-base font-bold text-blue-600">{issue.distinct_customers_count}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-400 block">Confidence</span>
                    <span className="text-base font-bold text-green-600">{issue.confidence}</span>
                  </div>
                </div>

                {/* Segments & Countries Tags */}
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 text-[11px] w-20 flex-shrink-0">Segments:</span>
                    <div className="flex flex-wrap gap-1">
                      {issue.segments.map((s, idx) => (
                        <span key={idx} className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-[10px] font-medium">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 text-[11px] w-20 flex-shrink-0">Countries:</span>
                    <span className="text-gray-700 font-medium text-[11px] truncate">
                      {issue.countries.join(', ')}
                    </span>
                  </div>
                </div>

                {/* Representative Original Quotes */}
                {issue.representative_comments && issue.representative_comments.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-gray-100">
                    <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">
                      Sample Customer Quote:
                    </span>
                    <p className="text-xs text-gray-600 italic bg-amber-50/50 p-2.5 rounded-lg border border-amber-100/60">
                      "{issue.representative_comments[0]}"
                    </p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-gray-100 flex items-center justify-between gap-3">
                <button
                  onClick={() => openSupportingModal(issue)}
                  className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-gray-500" />
                  <span>View All {issue.feedback_count} Comments</span>
                </button>

                <button
                  onClick={() => handleConvertToRequirement(issue)}
                  className="px-3.5 py-1.5 rounded-lg bg-[#F97316] hover:bg-[#EA580C] text-white font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <FileCheck2 className="w-3.5 h-3.5" />
                  <span>Create PRD Requirement</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Supporting Feedback Modal */}
      {activeIssue && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <div>
                <h3 className="text-sm font-bold text-[#1F2937]">Supporting Feedback for: {activeIssue.title}</h3>
                <p className="text-xs text-gray-500">
                  {supportingFeedback.length} verified customer submissions linked to this problem cluster
                </p>
              </div>
              <button
                onClick={() => setActiveIssue(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* List */}
            <div className="p-6 overflow-y-auto space-y-3">
              {loadingSupporting ? (
                <div className="py-12 text-center text-gray-400">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#F97316]" />
                  Retrieving supporting statements...
                </div>
              ) : (
                supportingFeedback.map((fb) => (
                  <div key={fb.feedback_id} className="p-3.5 rounded-xl border border-gray-100 bg-gray-50/50 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-gray-500">
                      <span className="font-mono font-bold text-[#1F2937]">{fb.feedback_id}</span>
                      <span>
                        {fb.customer_name || 'Anonymous'} &bull; {fb.country} &bull; {fb.channel}
                      </span>
                    </div>
                    <p className="text-gray-800 italic font-medium">"{fb.raw_text}"</p>
                    {fb.analysis && (
                      <div className="text-[11px] text-gray-500 flex items-center justify-between pt-1 border-t border-gray-200/50">
                        <span>Urgency: <strong className="text-red-600">{fb.analysis.urgency}</strong></span>
                        <span>Sentiment: <strong className="text-gray-700">{fb.analysis.sentiment}</strong></span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
              <button
                onClick={() => {
                  const iss = activeIssue;
                  setActiveIssue(null);
                  handleConvertToRequirement(iss);
                }}
                className="px-4 py-2 rounded-lg bg-[#F97316] text-white text-xs font-semibold hover:bg-[#EA580C] transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <FileCheck2 className="w-4 h-4" />
                <span>Turn Issue into Product Requirement</span>
              </button>

              <button
                onClick={() => setActiveIssue(null)}
                className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 cursor-pointer"
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
