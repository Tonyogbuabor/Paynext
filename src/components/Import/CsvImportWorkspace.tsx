import React, { useState, useEffect } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  Database,
  History,
  FileCheck,
  HelpCircle,
  Download,
} from 'lucide-react';
import Papa from 'papaparse';
import { api } from '../../services/api';
import type { ImportJob, ImportValidationIssue } from '../../types';

interface CsvImportWorkspaceProps {
  navigate: (route: string) => void;
}

const STANDARD_FIELDS = [
  { key: 'feedback_id', label: 'Feedback ID', required: true },
  { key: 'raw_text', label: 'Feedback Comment (raw_text)', required: true },
  { key: 'customer_name', label: 'Customer Name', required: false },
  { key: 'email', label: 'Email Address', required: false },
  { key: 'country', label: 'Country', required: false },
  { key: 'city', label: 'City', required: false },
  { key: 'customer_segment', label: 'Customer Segment', required: false },
  { key: 'plan_tier', label: 'Plan Tier', required: false },
  { key: 'channel', label: 'Intake Channel', required: false },
  { key: 'rating', label: 'Rating (1-5)', required: false },
  { key: 'nps_score', label: 'NPS Score (0-10)', required: false },
  { key: 'device', label: 'Device Model', required: false },
  { key: 'os', label: 'Operating System', required: false },
  { key: 'app_version', label: 'App Version', required: false },
  { key: 'submitted_at', label: 'Submission Timestamp', required: false },
];

export const CsvImportWorkspace: React.FC<CsvImportWorkspaceProps> = ({ navigate }) => {
  const [csvRawText, setCsvRawText] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [sampleRows, setSampleRows] = useState<any[]>([]);
  const [totalRows, setTotalRows] = useState<number>(0);
  const [validationIssues, setValidationIssues] = useState<ImportValidationIssue[]>([]);
  const [errorCount, setErrorCount] = useState<number>(0);
  const [warningCount, setWarningCount] = useState<number>(0);

  // Column mapping
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});

  // Mode: append or replace
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false);

  // Status
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Past jobs
  const [importJobs, setImportJobs] = useState<ImportJob[]>([]);

  useEffect(() => {
    loadJobHistory();
  }, []);

  const loadJobHistory = async () => {
    try {
      const res = await api.getImportHistory();
      setImportJobs(res.jobs);
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  };

  const handleFileSelect = (file: File) => {
    setFileName(file.name);
    setError(null);
    setImportResult(null);
    setParsing(true);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      setCsvRawText(text);

      try {
        const preview = await api.previewCsv(text);
        setHeaders(preview.headers);
        setSampleRows(preview.sampleRows);
        setTotalRows(preview.totalRows);
        setValidationIssues(preview.validationSummary.issues);
        setErrorCount(preview.validationSummary.errorCount);
        setWarningCount(preview.validationSummary.warningCount);

        // Auto-match headers to standard fields
        const autoMap: Record<string, string> = {};
        for (const sf of STANDARD_FIELDS) {
          const match = preview.headers.find(
            (h) =>
              h.toLowerCase() === sf.key.toLowerCase() ||
              h.toLowerCase().replace(/_/g, '') === sf.key.toLowerCase().replace(/_/g, '')
          );
          if (match) {
            autoMap[sf.key] = match;
          }
        }
        setColumnMapping(autoMap);
      } catch (err: any) {
        setError(err.message || 'Failed to inspect CSV file.');
      } finally {
        setParsing(false);
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleExecuteImport = async () => {
    if (!csvRawText) return;

    if (importMode === 'replace' && !showReplaceConfirm) {
      setShowReplaceConfirm(true);
      return;
    }

    try {
      setImporting(true);
      setError(null);
      const res = await api.processCsvImport({
        csvData: csvRawText,
        mode: importMode,
        columnMapping,
        filename: fileName || 'uploaded_customer_feedback.csv',
      });

      setImportResult(res);
      setShowReplaceConfirm(false);
      loadJobHistory();
    } catch (err: any) {
      setError(err.message || 'CSV Import failed.');
    } finally {
      setImporting(false);
    }
  };

  const handleLoadReferenceDataset = async () => {
    try {
      setImporting(true);
      setError(null);
      const res = await api.loadReferenceDataset();
      setImportResult({
        summary: {
          imported: res.imported,
          skipped: res.skipped,
          rejected: 0,
          totalRows: res.imported + res.skipped,
        },
      });
      loadJobHistory();
    } catch (err: any) {
      setError(err.message || 'Failed to load reference dataset.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1F2937] tracking-tight">CSV Data Ingestion & Validation</h1>
          <p className="text-xs text-gray-500 mt-1">
            Import customer feedback from CSV files, map columns, audit data fidelity, and append or replace database records.
          </p>
        </div>

        <button
          onClick={handleLoadReferenceDataset}
          disabled={importing}
          className="px-4 py-2 text-xs font-semibold bg-orange-50 text-[#F97316] hover:bg-orange-100 rounded-lg border border-orange-200 transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
        >
          <Database className="w-4 h-4" />
          <span>Load Reference Dataset (paynest_customer_feedback.csv)</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="font-bold">
            Dismiss
          </button>
        </div>
      )}

      {/* Import Result Notification */}
      {importResult && (
        <div className="p-5 rounded-xl bg-green-50 border border-green-200 text-[#1F2937] space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-green-700 font-bold text-sm">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <span>CSV Import & AI Sentiment Ingestion Completed!</span>
            </div>
            {importResult.summary.negativeCount !== undefined && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-100 text-red-700 border border-red-200">
                {importResult.summary.negativeCount} Negative Complaints Detected
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
            <div className="p-2.5 rounded-lg bg-white border border-green-200">
              <span className="text-gray-400 block text-[10px] uppercase">Imported Records</span>
              <span className="text-base font-bold text-green-600">{importResult.summary.imported}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-white border border-green-200">
              <span className="text-gray-400 block text-[10px] uppercase">Negative Complaints</span>
              <span className="text-base font-bold text-red-600">{importResult.summary.negativeCount ?? '—'}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-white border border-green-200">
              <span className="text-gray-400 block text-[10px] uppercase">Neutral Inquiries</span>
              <span className="text-base font-bold text-slate-700">{importResult.summary.neutralCount ?? '—'}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-white border border-green-200">
              <span className="text-gray-400 block text-[10px] uppercase">Positive Praise</span>
              <span className="text-base font-bold text-green-600">{importResult.summary.positiveCount ?? '—'}</span>
            </div>
          </div>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            {importResult.summary.negativeCount > 0 && (
              <button
                onClick={() => navigate('/admin/feedback?sentiment=Negative')}
                className="px-3.5 py-1.5 bg-[#DC2626] text-white text-xs font-semibold rounded-lg hover:bg-red-700 transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5"
              >
                <span>View {importResult.summary.negativeCount} Negative Complaints</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => navigate('/admin/feedback')}
              className="px-3.5 py-1.5 bg-[#F97316] text-white text-xs font-semibold rounded-lg hover:bg-[#EA580C] transition-colors cursor-pointer"
            >
              Explore Ingested Feedback
            </button>
            <button
              onClick={() => navigate('/admin/dashboard')}
              className="px-3.5 py-1.5 bg-white text-gray-700 text-xs font-semibold rounded-lg border border-gray-300 hover:bg-gray-50 cursor-pointer"
            >
              View Updated Dashboard
            </button>
          </div>
        </div>
      )}

      {/* Drag & Drop Upload Zone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className="bg-white rounded-2xl border-2 border-dashed border-gray-300 hover:border-[#F97316] p-8 text-center transition-all cursor-pointer group shadow-2xs"
        onClick={() => document.getElementById('csvFileInput')?.click()}
      >
        <input
          id="csvFileInput"
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
          className="hidden"
        />

        <div className="w-14 h-14 rounded-2xl bg-orange-50 text-[#F97316] flex items-center justify-center mx-auto mb-3 group-hover:scale-105 transition-transform">
          <UploadCloud className="w-7 h-7" />
        </div>

        <h3 className="text-base font-bold text-[#1F2937] mb-1">
          {fileName ? fileName : 'Choose or drop your CSV feedback file'}
        </h3>
        <p className="text-xs text-gray-500 max-w-sm mx-auto mb-4">
          Upload any customer feedback export. The platform automatically maps headers matching the 18 PayNext fields.
        </p>

        <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-100 group-hover:bg-[#F97316] group-hover:text-white rounded-xl text-xs font-semibold text-gray-700 transition-colors">
          <FileSpreadsheet className="w-4 h-4" />
          Browse Files (.csv)
        </span>
      </div>

      {/* Inspection & Validation Report */}
      {csvRawText && (
        <div className="space-y-6">
          {/* Validation Metrics Banner */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-[#1F2937] flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-green-600" />
                  Pre-Import Validation & Audit Summary
                </h3>
                <p className="text-xs text-gray-500">
                  {totalRows} total rows parsed &bull; {headers.length} columns detected
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {totalRows - errorCount} Valid
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {warningCount} Warnings
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {errorCount} Errors
                </span>
              </div>
            </div>

            {/* Validation Issues list */}
            {validationIssues.length > 0 ? (
              <div className="max-h-44 overflow-y-auto space-y-1.5 border border-gray-100 rounded-lg p-2 bg-gray-50/50">
                {validationIssues.slice(0, 10).map((issue, idx) => (
                  <div
                    key={idx}
                    className={`text-xs p-2 rounded flex items-center justify-between ${
                      issue.severity === 'error'
                        ? 'bg-red-50 text-red-700 border border-red-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}
                  >
                    <span>
                      <strong className="font-semibold">Row {issue.row}</strong>: {issue.message}
                    </span>
                    <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-white/70">
                      {issue.field}
                    </span>
                  </div>
                ))}
                {validationIssues.length > 10 && (
                  <div className="text-center text-[11px] text-gray-500 py-1">
                    + {validationIssues.length - 10} additional validation notices
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 bg-green-50 rounded-lg border border-green-200 text-xs text-green-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span>All rows passed required schema checks and field validations.</span>
              </div>
            )}
          </div>

          {/* Column Mapping Interface */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-2xs">
            <h3 className="text-sm font-bold text-[#1F2937] mb-1">Column Mapping Interface</h3>
            <p className="text-xs text-gray-500 mb-4">
              Verify how your uploaded columns correspond to the PayNext standardized schema.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {STANDARD_FIELDS.map((field) => (
                <div key={field.key} className="p-2.5 rounded-lg border border-gray-100 bg-gray-50/60">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-[#1F2937]">
                      {field.label} {field.required && <span className="text-red-500">*</span>}
                    </span>
                  </div>
                  <select
                    value={columnMapping[field.key] || ''}
                    onChange={(e) =>
                      setColumnMapping({ ...columnMapping, [field.key]: e.target.value })
                    }
                    className="w-full text-xs py-1 px-2 border border-gray-200 rounded bg-white text-gray-700"
                  >
                    <option value="">-- Ignore / Not Provided --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Sample Rows Preview */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-2xs">
            <h3 className="text-sm font-bold text-[#1F2937] mb-1">Uploaded Data Preview (First 5 Rows)</h3>
            <p className="text-xs text-gray-500 mb-3">Live tabular preview of parsed CSV rows</p>

            <div className="overflow-x-auto border border-gray-100 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold">
                  <tr>
                    {headers.slice(0, 7).map((h) => (
                      <th key={h} className="py-2.5 px-3">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sampleRows.slice(0, 5).map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      {headers.slice(0, 7).map((h) => (
                        <td key={h} className="py-2 px-3 text-gray-700 max-w-[200px] truncate">
                          {row[h] !== undefined && row[h] !== null ? String(row[h]) : '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Import Execution Controls */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="text-xs font-semibold text-[#1F2937]">Import Strategy:</div>
              <label className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer">
                <input
                  type="radio"
                  name="importMode"
                  checked={importMode === 'append'}
                  onChange={() => {
                    setImportMode('append');
                    setShowReplaceConfirm(false);
                  }}
                  className="text-[#F97316] focus:ring-[#F97316]"
                />
                <span>Append new records (skip existing feedback_ids)</span>
              </label>

              <label className="flex items-center gap-1.5 text-xs text-red-600 cursor-pointer">
                <input
                  type="radio"
                  name="importMode"
                  checked={importMode === 'replace'}
                  onChange={() => setImportMode('replace')}
                  className="text-red-600 focus:ring-red-600"
                />
                <span>Replace entire dataset</span>
              </label>
            </div>

            <div className="flex items-center gap-3">
              {showReplaceConfirm && (
                <span className="text-xs text-red-600 font-semibold animate-pulse">
                  Are you sure? Click again to confirm dataset overwrite.
                </span>
              )}
              <button
                onClick={handleExecuteImport}
                disabled={importing}
                className="px-6 py-2.5 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white font-semibold text-xs transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {importing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Processing Ingestion...</span>
                  </>
                ) : (
                  <>
                    <span>Execute Import ({totalRows} Rows)</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Historical Import Jobs */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-2xs">
        <h3 className="text-sm font-bold text-[#1F2937] mb-1 flex items-center gap-2">
          <History className="w-4 h-4 text-gray-500" />
          Ingestion Audit Trail & Job History
        </h3>
        <p className="text-xs text-gray-500 mb-4">Past file imports and reconciliation reports</p>

        {importJobs.length > 0 ? (
          <div className="space-y-2">
            {importJobs.map((job) => (
              <div
                key={job.id}
                className="p-3 rounded-lg border border-gray-100 hover:border-gray-200 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div>
                  <div className="font-bold text-[#1F2937] flex items-center gap-2">
                    <span>{job.filename}</span>
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-600">
                      {job.id}
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-400 mt-0.5">
                    Imported on {new Date(job.imported_at).toLocaleString()}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-green-600 font-bold">{job.imported_count} imported</span>
                  <span className="text-amber-600 font-medium">{job.skipped_count} skipped</span>
                  <span className="text-red-600 font-medium">{job.rejected_count} rejected</span>
                  <span className="text-gray-400 font-normal">of {job.total_rows} total</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-xs text-gray-400">
            No historical import jobs recorded yet.
          </div>
        )}
      </div>
    </div>
  );
};
