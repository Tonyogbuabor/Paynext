import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Play,
  RotateCcw,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Layers,
  ArrowRight,
  Filter,
  Check,
  Search,
  ExternalLink,
} from 'lucide-react';
import { api } from '../../services/api';
import type { FeedbackWithAnalysis, AIAnalysis } from '../../types';

interface AiAnalysisWorkspaceProps {
  navigate: (route: string) => void;
}

export const AiAnalysisWorkspace: React.FC<AiAnalysisWorkspaceProps> = ({ navigate }) => {
  const [stats, setStats] = useState<{
    total: number;
    completed: number;
    failed: number;
    pending: number;
  }>({ total: 0, completed: 0, failed: 0, pending: 0 });

  const [records, setRecords] = useState<FeedbackWithAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [batchSize, setBatchSize] = useState(10);
  const [analysisProgress, setAnalysisProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);

  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterSentiment, setFilterSentiment] = useState<string>('all');
  const [search, setSearch] = useState<string>('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [sRes, fRes] = await Promise.all([
        api.getAnalysisStats(),
        api.getFeedback({ limit: 100 }),
      ]);
      setStats(sRes);
      setRecords(fRes.data);
    } catch (err) {
      console.error('Failed to load analysis workspace:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRunBatch = async (forceAll = false) => {
    try {
      setAnalyzing(true);
      const res = await api.triggerBatchAnalysis(batchSize, forceAll);
      await loadData();
    } catch (err) {
      console.error('Batch analysis error:', err);
    } finally {
      setAnalyzing(false);
      setAnalysisProgress(null);
    }
  };

  const handleRunAllBatchesUntilDone = async () => {
    try {
      setAnalyzing(true);
      let remaining = stats.pending;
      let totalToAnalyze = remaining;
      let processed = 0;

      while (remaining > 0) {
        setAnalysisProgress({ current: processed, total: totalToAnalyze });
        const res = await api.triggerBatchAnalysis(batchSize, false);
        processed += res.analyzed_count;
        remaining = res.remaining_count;
        if (res.analyzed_count === 0) break;
      }
      await loadData();
    } catch (err) {
      console.error('Continuous batch error:', err);
    } finally {
      setAnalyzing(false);
      setAnalysisProgress(null);
    }
  };

  const negativeCount = records.filter((r) => r.analysis?.sentiment === 'Negative').length;
  const neutralCount = records.filter((r) => r.analysis?.sentiment === 'Neutral').length;
  const positiveCount = records.filter((r) => r.analysis?.sentiment === 'Positive').length;

  const filteredRecords = records.filter((r) => {
    if (filterStatus === 'completed' && r.analysis?.status !== 'Completed') return false;
    if (filterStatus === 'pending' && r.analysis?.status === 'Completed') return false;
    if (filterSentiment !== 'all' && r.analysis?.sentiment !== filterSentiment) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        r.feedback_id.toLowerCase().includes(q) ||
        r.raw_text.toLowerCase().includes(q) ||
        (r.analysis?.primary_category && r.analysis.primary_category.toLowerCase().includes(q)) ||
        (r.analysis?.summary && r.analysis.summary.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1F2937] tracking-tight flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-[#F97316]" />
            AI Customer Feedback Intelligence Engine
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Server-side batch processing powered by Gemini 3.8 Flash for sentiment, product friction categorization, urgency, and evidence extraction.
          </p>
        </div>

        <button
          onClick={() => navigate('/admin/insights')}
          className="px-4 py-2 text-xs font-semibold bg-white text-[#1F2937] hover:bg-gray-50 rounded-lg border border-gray-300 transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
        >
          <Layers className="w-4 h-4 text-[#F97316]" />
          <span>Go to Product Insights</span>
        </button>
      </div>

      {/* Progress & Batch Controls Panel */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-2xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Stats overview */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full lg:w-auto">
            <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
              <span className="text-[10px] uppercase font-bold text-gray-400 block">Total Ingested</span>
              <span className="text-xl font-bold text-[#1F2937]">{stats.total}</span>
            </div>
            <div className="p-3 rounded-lg bg-green-50/60 border border-green-100">
              <span className="text-[10px] uppercase font-bold text-green-700 block">Analyzed (Cached)</span>
              <span className="text-xl font-bold text-green-600">{stats.completed}</span>
            </div>
            <div className="p-3 rounded-lg bg-orange-50/60 border border-orange-100">
              <span className="text-[10px] uppercase font-bold text-orange-700 block">Pending Analysis</span>
              <span className="text-xl font-bold text-[#F97316]">{stats.pending}</span>
            </div>
            <div className="p-3 rounded-lg bg-red-50/60 border border-red-100">
              <span className="text-[10px] uppercase font-bold text-red-700 block">Failed Jobs</span>
              <span className="text-xl font-bold text-red-600">{stats.failed}</span>
            </div>
          </div>

          {/* Action triggers */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-gray-500 mr-2">
              <span>Batch size:</span>
              <select
                value={batchSize}
                onChange={(e) => setBatchSize(Number(e.target.value))}
                className="py-1 px-2 border border-gray-200 rounded text-xs bg-white text-[#1F2937]"
              >
                <option value="5">5 records</option>
                <option value="10">10 records</option>
                <option value="15">15 records</option>
                <option value="20">20 records</option>
              </select>
            </div>

            <button
              onClick={() => handleRunBatch(false)}
              disabled={analyzing || stats.pending === 0}
              className="px-4 py-2 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white font-semibold text-xs transition-colors shadow-sm flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Process Single Batch ({Math.min(batchSize, stats.pending || batchSize)})</span>
            </button>

            <button
              onClick={handleRunAllBatchesUntilDone}
              disabled={analyzing || stats.pending === 0}
              className="px-4 py-2 rounded-xl bg-[#172554] hover:bg-[#1E3A8A] text-white font-semibold text-xs transition-colors shadow-sm flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-orange-400" />
              <span>Analyze All Pending ({stats.pending})</span>
            </button>

            <button
              onClick={() => handleRunBatch(true)}
              disabled={analyzing || stats.total === 0}
              className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs transition-colors flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
              title="Force re-analyze completed records"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Force Re-analyze</span>
            </button>
          </div>
        </div>

        {/* Live Progress Bar when active */}
        {analyzing && (
          <div className="pt-2">
            <div className="flex items-center justify-between text-xs text-gray-600 mb-1 font-medium">
              <span className="flex items-center gap-1.5 text-[#F97316]">
                <Sparkles className="w-3.5 h-3.5 animate-spin" />
                Gemini AI is analyzing customer statements...
              </span>
              <span>
                {analysisProgress ? `${analysisProgress.current} / ${analysisProgress.total}` : 'Executing batch...'}
              </span>
            </div>
            <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
              <div
                style={{
                  width: analysisProgress
                    ? `${Math.max(10, (analysisProgress.current / analysisProgress.total) * 100)}%`
                    : '65%',
                }}
                className="h-full bg-[#F97316] rounded-full transition-all duration-300 animate-pulse"
              />
            </div>
          </div>
        )}
      </div>

      {/* Quick Sentiment Filter Pills */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setFilterSentiment('all')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
            filterSentiment === 'all'
              ? 'bg-[#1F2937] text-white shadow-2xs'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          <span>All Records ({records.length})</span>
        </button>

        <button
          onClick={() => setFilterSentiment('Negative')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
            filterSentiment === 'Negative'
              ? 'bg-[#DC2626] text-white shadow-2xs'
              : 'bg-white text-red-600 border border-red-200 hover:bg-red-50'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-red-400"></span>
          <span>Negative Complaints ({negativeCount})</span>
        </button>

        <button
          onClick={() => setFilterSentiment('Neutral')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
            filterSentiment === 'Neutral'
              ? 'bg-slate-700 text-white shadow-2xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-slate-400"></span>
          <span>Neutral Inquiries ({neutralCount})</span>
        </button>

        <button
          onClick={() => setFilterSentiment('Positive')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
            filterSentiment === 'Positive'
              ? 'bg-[#16A34A] text-white shadow-2xs'
              : 'bg-white text-green-700 border border-green-200 hover:bg-green-50'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-green-500"></span>
          <span>Positive Praise ({positiveCount})</span>
        </button>
      </div>

      {filterSentiment === 'Negative' && (
        <div className="bg-red-50 border border-red-200 text-red-800 text-xs px-4 py-2.5 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
            <span className="font-semibold">Negative Feedback Intelligence Filter Active:</span>
            <span>Showing {negativeCount} categorized customer complaints and issue reports.</span>
          </div>
          <button
            onClick={() => setFilterSentiment('all')}
            className="text-red-700 underline text-[11px] font-bold hover:text-red-900 cursor-pointer"
          >
            Show All
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search AI analysis by category, summary, evidence..."
            className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-[#1F2937] focus:outline-none focus:ring-1 focus:ring-[#F97316]"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="text-xs py-2 px-3 bg-gray-50 border border-gray-200 rounded-lg text-[#1F2937]"
          >
            <option value="all">All Analysis Statuses</option>
            <option value="completed">Completed Only</option>
            <option value="pending">Pending Only</option>
          </select>

          <select
            value={filterSentiment}
            onChange={(e) => setFilterSentiment(e.target.value)}
            className="text-xs py-2 px-3 bg-gray-50 border border-gray-200 rounded-lg text-[#1F2937]"
          >
            <option value="all">All Sentiments</option>
            <option value="Positive">Positive</option>
            <option value="Neutral">Neutral</option>
            <option value="Negative">Negative</option>
          </select>
        </div>
      </div>

      {/* Structured AI Analysis Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredRecords.map((item) => {
          const anl = item.analysis;
          const isDone = anl && anl.status === 'Completed';

          return (
            <div
              key={item.feedback_id}
              className="bg-white rounded-xl border border-[#E2E8F0] hover:border-gray-300 p-5 shadow-2xs space-y-3 transition-all"
            >
              {/* Card Header */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-[#1F2937]">{item.feedback_id}</span>
                  <span className="text-gray-400">&bull;</span>
                  <span className="text-gray-500">{item.channel}</span>
                </div>

                {isDone ? (
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                      anl.sentiment === 'Positive'
                        ? 'bg-green-50 text-[#16A34A] border border-green-200'
                        : anl.sentiment === 'Negative'
                        ? 'bg-red-50 text-[#DC2626] border border-red-200'
                        : 'bg-slate-50 text-slate-700 border border-slate-200'
                    }`}
                  >
                    {anl.sentiment}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-amber-600 font-medium text-xs">
                    <Clock className="w-3.5 h-3.5" />
                    Pending Analysis
                  </span>
                )}
              </div>

              {/* Raw Customer Comment */}
              <div className="text-xs text-[#1F2937] bg-slate-50 p-3 rounded-lg border border-slate-100 font-medium italic">
                "{item.raw_text}"
              </div>

              {/* Structured AI Output if completed */}
              {isDone ? (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#1F2937]">{anl.primary_category}</span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        anl.urgency === 'Critical'
                          ? 'bg-red-100 text-red-800'
                          : anl.urgency === 'High'
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      Urgency: {anl.urgency}
                    </span>
                  </div>

                  <p className="text-xs text-gray-600">
                    <strong className="text-gray-700">Summary: </strong>
                    {anl.summary}
                  </p>

                  <p className="text-xs text-gray-600">
                    <strong className="text-gray-700">Friction Point: </strong>
                    {anl.customer_pain_point}
                  </p>

                  <div className="text-[11px] text-gray-500 bg-orange-50/50 p-2 rounded border border-orange-100">
                    <span className="font-semibold text-orange-900 block">Extracted Evidence:</span>
                    "{anl.evidence}"
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1">
                    <span>Product Area: {anl.product_area}</span>
                    <span>Confidence: {anl.confidence}</span>
                  </div>
                </div>
              ) : (
                <div className="py-4 text-center">
                  <button
                    onClick={() => api.analyzeSingleFeedback(item.feedback_id).then(loadData)}
                    className="px-3 py-1.5 text-xs font-semibold text-[#F97316] bg-orange-50 hover:bg-orange-100 rounded-lg border border-orange-200 transition-colors inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Analyze This Record</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
