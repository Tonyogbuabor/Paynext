import React, { useState, useEffect } from 'react';
import {
  FileBarChart,
  Download,
  FileSpreadsheet,
  ShieldCheck,
  Calendar,
  Filter,
  CheckCircle2,
  RefreshCw,
  Eye,
  FileText,
  Printer,
} from 'lucide-react';
import { api } from '../../services/api';

export const ReportsWorkspace: React.FC = () => {
  const [reportData, setReportData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [redactPii, setRedactPii] = useState(true);
  const [dateRange, setDateRange] = useState('all');

  const generateReport = async () => {
    try {
      setLoading(true);
      const res = await api.generateReport({
        filters: { dateRange },
        includeApprovedReqs: true,
        redactPII: redactPii,
      });
      setReportData(res);
    } catch (err) {
      console.error('Failed to generate report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    generateReport();
  }, [dateRange, redactPii]);

  const handleDownloadCsv = () => {
    const token = localStorage.getItem('paynext_admin_token') || '';
    window.open(`/api/admin/reports/export-csv?token=${token}&redactPII=${redactPii}`, '_blank');
  };

  const handleDownloadRequirements = () => {
    const token = localStorage.getItem('paynext_admin_token') || '';
    window.open(`/api/admin/requirements/export?token=${token}`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1F2937] tracking-tight flex items-center gap-2">
            <FileBarChart className="w-6 h-6 text-[#F97316]" />
            Intelligence Reports & Compliance Exports
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Generate executive briefings, recurring issue summaries, and GDPR/CCPA privacy-redacted raw feedback CSV exports.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadCsv}
            className="px-3.5 py-2 text-xs font-semibold bg-[#F97316] hover:bg-[#EA580C] text-white rounded-lg transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Ingested Feedback (CSV)</span>
          </button>

          <button
            onClick={handleDownloadRequirements}
            className="px-3.5 py-2 text-xs font-semibold bg-white text-gray-700 hover:bg-gray-50 rounded-lg border border-gray-300 transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-gray-500" />
            <span>Export Requirements Spec (CSV)</span>
          </button>
        </div>
      </div>

      {/* Report Controls Strip */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#F97316]" />
            <span className="text-xs font-bold text-gray-700">Timeframe:</span>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="text-xs py-1 px-2.5 bg-gray-50 border border-gray-200 rounded-lg text-[#1F2937]"
            >
              <option value="all">All Available Records</option>
              <option value="30d">Last 30 Days</option>
              <option value="7d">Last 7 Days</option>
            </select>
          </div>

          <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer font-medium">
            <input
              type="checkbox"
              checked={redactPii}
              onChange={(e) => setRedactPii(e.target.checked)}
              className="rounded text-[#F97316] focus:ring-[#F97316]"
            />
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-green-600" />
              Redact Customer PII (Names & Emails) in Exports
            </span>
          </label>
        </div>

        <button
          onClick={() => window.print()}
          className="px-3 py-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>Print / PDF Briefing</span>
        </button>
      </div>

      {/* Report Body Paper View */}
      {loading ? (
        <div className="py-20 text-center text-gray-400 bg-white rounded-2xl border border-gray-200">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#F97316]" />
          Generating intelligence briefing...
        </div>
      ) : reportData ? (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-8 space-y-8 max-w-4xl mx-auto print:border-none print:shadow-none">
          {/* Header */}
          <div className="border-b border-gray-200 pb-6 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 text-[#F97316] font-bold text-sm mb-1 uppercase tracking-wider">
                <span>PayNext Financial Services</span>
                <span>&bull;</span>
                <span>Product Operations</span>
              </div>
              <h2 className="text-2xl font-bold text-[#1F2937]">{reportData.reportTitle}</h2>
              <p className="text-xs text-gray-500 mt-1">
                Generated: {new Date(reportData.generatedAt).toLocaleString()} &bull; PII Protection:{' '}
                {redactPii ? 'Active (Redacted)' : 'Unredacted'}
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs px-2.5 py-1 rounded bg-orange-100 text-[#F97316] font-bold">
                CONFIDENTIAL
              </span>
            </div>
          </div>

          {/* Section 1: Executive KPI Overview */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-700">
              1. Executive Metrics & Satisfaction Signals
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                <span className="text-gray-400 block text-[10px] uppercase font-bold">Total Ingested</span>
                <span className="text-xl font-bold text-[#1F2937]">{reportData.metrics.totalFeedback}</span>
              </div>
              <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                <span className="text-gray-400 block text-[10px] uppercase font-bold">Average Rating</span>
                <span className="text-xl font-bold text-amber-600">
                  {reportData.metrics.averageRating || 'N/A'} / 5.0
                </span>
              </div>
              <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                <span className="text-gray-400 block text-[10px] uppercase font-bold">Net Promoter Score</span>
                <span className="text-xl font-bold text-green-600">
                  {reportData.metrics.averageNps !== null ? reportData.metrics.averageNps : 'N/A'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                <span className="text-gray-400 block text-[10px] uppercase font-bold">Negative Complaint %</span>
                <span className="text-xl font-bold text-red-600">
                  {reportData.metrics.negativeFeedbackPercentage}%
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Top Recurring Customer Problems */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-700">
              2. Top Recurring Customer Problems
            </h3>
            <div className="space-y-3">
              {reportData.topRecurringProblems.map((prob: any, idx: number) => (
                <div key={idx} className="p-4 rounded-xl border border-gray-200 bg-gray-50/50 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between font-bold text-[#1F2937]">
                    <span className="text-sm">
                      {idx + 1}. {prob.title}
                    </span>
                    <span className="text-[#F97316]">{prob.feedback_count} Supporting Reports</span>
                  </div>
                  <p className="text-gray-600">{prob.description}</p>
                  <div className="text-[11px] text-gray-500 pt-1 flex items-center justify-between">
                    <span>Product Area: {prob.product_area}</span>
                    <span>Confidence: {prob.confidence}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Approved Product Requirements */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-700">
              3. Approved Product Requirements Specifications
            </h3>
            {reportData.approvedRequirements.length > 0 ? (
              <div className="space-y-3">
                {reportData.approvedRequirements.map((req: any) => (
                  <div key={req.id} className="p-4 rounded-xl border border-green-200 bg-green-50/20 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-[#1F2937]">{req.title}</span>
                      <span className="px-2 py-0.5 rounded bg-green-100 text-green-800 font-bold text-[10px]">
                        Approved
                      </span>
                    </div>
                    <div className="font-medium text-gray-800 bg-white p-2 rounded border border-green-100">
                      <strong>User Story: </strong> {req.user_story}
                    </div>
                    <div className="text-gray-600">
                      <strong>Priority ({req.priority}): </strong> {req.priority_rationale}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500 italic">No approved requirements in current filter set.</p>
            )}
          </div>

          {/* Section 4: Representative Customer Quotes */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-700">
              4. Representative Customer Statements
            </h3>
            <div className="space-y-2">
              {reportData.sampleRepresentativeComments.map((c: any) => (
                <div key={c.feedback_id} className="p-3 rounded-lg border border-gray-100 bg-gray-50 text-xs">
                  <div className="flex items-center justify-between text-gray-400 text-[10px] mb-1">
                    <span>
                      {c.feedback_id} &bull; {c.country} &bull; {c.channel}
                    </span>
                    <span className="font-bold text-[#F97316]">{c.category}</span>
                  </div>
                  <p className="text-gray-800 italic">"{c.raw_text}"</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
