import React, { useState, useEffect } from 'react';
import {
  FileCheck2,
  Sparkles,
  Download,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  HelpCircle,
  FileEdit,
  ArrowRight,
  ShieldAlert,
  ChevronDown,
  Layers,
  Search,
  ExternalLink,
  Save,
  MessageSquare,
  AlertTriangle,
} from 'lucide-react';
import { api } from '../../services/api';
import type {
  ProductRequirement,
  RecurringIssue,
  RequirementPriority,
  RequirementReviewStatus,
} from '../../types';

interface RequirementsWorkspaceProps {
  initialIssue?: RecurringIssue | null;
  navigate: (route: string) => void;
}

export const RequirementsWorkspace: React.FC<RequirementsWorkspaceProps> = ({
  initialIssue,
  navigate,
}) => {
  const [requirements, setRequirements] = useState<ProductRequirement[]>([]);
  const [issues, setIssues] = useState<RecurringIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Active requirement in editor/view
  const [selectedReq, setSelectedReq] = useState<ProductRequirement | null>(null);

  // Filter
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');

  // Review modal
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewAction, setReviewAction] = useState<RequirementReviewStatus>('Approved');
  const [reviewNotes, setReviewNotes] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [rRes, iRes] = await Promise.all([api.getRequirements(), api.getInsights()]);
      setRequirements(rRes.requirements);
      setIssues(iRes.issues);

      if (rRes.requirements.length > 0 && !selectedReq) {
        setSelectedReq(rRes.requirements[0]);
      }
    } catch (err: any) {
      console.error('Failed to load requirements:', err);
      setError(err.message || 'Error loading product requirements.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // If navigated from an issue, auto-trigger generation
  useEffect(() => {
    if (initialIssue) {
      handleGenerateFromIssue(initialIssue.id);
    }
  }, [initialIssue]);

  const handleGenerateFromIssue = async (issueId: string) => {
    try {
      setGenerating(true);
      setError(null);
      const res = await api.generateRequirement(issueId);
      setRequirements((prev) => [res.requirement, ...prev]);
      setSelectedReq(res.requirement);
    } catch (err: any) {
      console.error('Failed to generate requirement:', err);
      setError(err.message || 'Failed to generate product requirement.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveEdits = async () => {
    if (!selectedReq) return;
    try {
      setSaving(true);
      const res = await api.updateRequirement(selectedReq.id, selectedReq);
      setSelectedReq(res.requirement);
      setRequirements((prev) =>
        prev.map((r) => (r.id === res.requirement.id ? res.requirement : r))
      );
    } catch (err: any) {
      setError(err.message || 'Failed to save edits.');
    } finally {
      setSaving(false);
    }
  };

  const handleApplyReview = async () => {
    if (!selectedReq) return;
    try {
      setSaving(true);
      const res = await api.reviewRequirement(selectedReq.id, reviewAction, reviewNotes);
      setSelectedReq(res.requirement);
      setRequirements((prev) =>
        prev.map((r) => (r.id === res.requirement.id ? res.requirement : r))
      );
      setShowReviewModal(false);
      setReviewNotes('');
    } catch (err: any) {
      setError(err.message || 'Failed to update review status.');
    } finally {
      setSaving(false);
    }
  };

  const handleExportCsv = () => {
    window.open('/api/admin/requirements/export?token=' + localStorage.getItem('paynext_admin_token'), '_blank');
  };

  const filteredRequirements = requirements.filter((r) => {
    if (filterStatus !== 'all' && r.review_status !== filterStatus) return false;
    if (filterPriority !== 'all' && r.priority !== filterPriority) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Title & Quick Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1F2937] tracking-tight flex items-center gap-2">
            <FileCheck2 className="w-6 h-6 text-[#F97316]" />
            Evidence-Based Product Requirements Workspace
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Convert customer complaint clusters into testable user stories, acceptance criteria, and prioritized technical requirements.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Issue dropdown to generate requirement */}
          {issues.length > 0 && (
            <div className="relative">
              <select
                onChange={(e) => e.target.value && handleGenerateFromIssue(e.target.value)}
                defaultValue=""
                disabled={generating}
                className="px-3.5 py-2 text-xs font-semibold bg-[#F97316] text-white hover:bg-[#EA580C] rounded-lg transition-colors shadow-sm cursor-pointer disabled:opacity-50"
              >
                <option value="" disabled>
                  {generating ? 'Generating Requirement...' : '+ Generate from Issue...'}
                </option>
                {issues.map((i) => (
                  <option key={i.id} value={i.id} className="text-gray-900 bg-white">
                    {i.title.slice(0, 45)}... ({i.feedback_count} reports)
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={handleExportCsv}
            className="px-3.5 py-2 text-xs font-semibold bg-white text-gray-700 hover:bg-gray-50 rounded-lg border border-gray-300 transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-gray-500" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
          {error}
        </div>
      )}

      {/* Main 2-Column Split: Requirements List on left, Full Spec Editor on right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Requirements Index */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-[#E2E8F0] shadow-2xs p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-gray-100">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Requirements ({filteredRequirements.length})
            </span>
            <div className="flex items-center gap-1.5">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="text-[11px] py-1 px-1.5 border border-gray-200 rounded text-gray-600 bg-gray-50"
              >
                <option value="all">All Status</option>
                <option value="Draft">Draft</option>
                <option value="Approved">Approved</option>
                <option value="Needs Investigation">Needs Invest.</option>
                <option value="Revision Requested">Revision</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
          </div>

          {requirements.length === 0 ? (
            <div className="py-12 text-center text-xs text-gray-400">
              No requirements created yet. Select an issue from the top dropdown or visit Product Insights to generate one.
            </div>
          ) : (
            <div className="space-y-2 max-h-[700px] overflow-y-auto pr-1">
              {filteredRequirements.map((req) => {
                const isSelected = selectedReq?.id === req.id;
                return (
                  <div
                    key={req.id}
                    onClick={() => setSelectedReq(req)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer text-xs space-y-1.5 ${
                      isSelected
                        ? 'border-[#F97316] bg-orange-50/40 shadow-xs'
                        : 'border-gray-100 hover:border-gray-300 bg-gray-50/30'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] text-gray-400 font-bold">{req.id}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          req.review_status === 'Approved'
                            ? 'bg-green-100 text-green-800'
                            : req.review_status === 'Rejected'
                            ? 'bg-red-100 text-red-800'
                            : req.review_status === 'Draft'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {req.review_status}
                      </span>
                    </div>

                    <h4 className="font-bold text-[#1F2937] leading-tight line-clamp-2">
                      {req.title}
                    </h4>

                    <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1">
                      <span
                        className={`font-semibold ${
                          req.priority === 'Critical'
                            ? 'text-red-600'
                            : req.priority === 'High'
                            ? 'text-orange-600'
                            : 'text-gray-600'
                        }`}
                      >
                        {req.priority} Priority
                      </span>
                      <span>{req.supporting_feedback_ids.length} supporting reports</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Full Interactive Requirement Spec Editor & Review */}
        <div className="lg:col-span-8 bg-white rounded-xl border border-[#E2E8F0] shadow-2xs p-6 space-y-6">
          {selectedReq ? (
            <>
              {/* Header Status & Action Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs font-bold text-gray-400">{selectedReq.id}</span>
                    <span
                      className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                        selectedReq.review_status === 'Approved'
                          ? 'bg-green-100 text-green-800 border border-green-200'
                          : selectedReq.review_status === 'Rejected'
                          ? 'bg-red-100 text-red-800 border border-red-200'
                          : selectedReq.review_status === 'Draft'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-blue-100 text-blue-800 border border-blue-200'
                      }`}
                    >
                      {selectedReq.review_status}
                    </span>
                    {selectedReq.reviewed_by && (
                      <span className="text-xs text-gray-400">
                        by {selectedReq.reviewed_by} on {new Date(selectedReq.reviewed_at!).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={selectedReq.title}
                    onChange={(e) => setSelectedReq({ ...selectedReq, title: e.target.value })}
                    className="text-lg font-bold text-[#1F2937] w-full border-b border-transparent hover:border-gray-300 focus:border-[#F97316] focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={handleSaveEdits}
                    disabled={saving}
                    className="px-3.5 py-2 text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{saving ? 'Saving...' : 'Save Draft'}</span>
                  </button>

                  <button
                    onClick={() => setShowReviewModal(true)}
                    className="px-4 py-2 text-xs font-semibold bg-[#F97316] hover:bg-[#EA580C] text-white rounded-lg transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Review & Approve</span>
                  </button>
                </div>
              </div>

              {/* Review Notes Alert if present */}
              {selectedReq.review_notes && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900">
                  <strong>Reviewer Notes: </strong>
                  {selectedReq.review_notes}
                </div>
              )}

              {/* User Story Box */}
              <div className="bg-orange-50/50 rounded-xl p-4 border border-orange-200">
                <div className="text-[10px] font-bold uppercase tracking-wider text-orange-800 mb-1">
                  Target User Story
                </div>
                <textarea
                  value={selectedReq.user_story}
                  onChange={(e) => setSelectedReq({ ...selectedReq, user_story: e.target.value })}
                  rows={2}
                  className="w-full text-sm font-semibold text-[#1F2937] bg-white p-2.5 rounded-lg border border-orange-200 focus:outline-none focus:ring-1 focus:ring-[#F97316]"
                />
              </div>

              {/* Problem Statement & Evidence Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Problem Statement</label>
                  <textarea
                    value={selectedReq.problem_statement}
                    onChange={(e) => setSelectedReq({ ...selectedReq, problem_statement: e.target.value })}
                    rows={4}
                    className="w-full text-xs text-gray-800 p-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-[#F97316]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Evidence Summary</label>
                  <textarea
                    value={selectedReq.evidence_summary}
                    onChange={(e) => setSelectedReq({ ...selectedReq, evidence_summary: e.target.value })}
                    rows={4}
                    className="w-full text-xs text-gray-800 p-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-[#F97316]"
                  />
                </div>
              </div>

              {/* Proposed Solution & Affected Groups */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Proposed Technical Improvement
                  </label>
                  <textarea
                    value={selectedReq.proposed_solution}
                    onChange={(e) => setSelectedReq({ ...selectedReq, proposed_solution: e.target.value })}
                    rows={3}
                    className="w-full text-xs text-gray-800 p-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-[#F97316]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Affected Customer Groups
                  </label>
                  <textarea
                    value={selectedReq.affected_customer_groups}
                    onChange={(e) =>
                      setSelectedReq({ ...selectedReq, affected_customer_groups: e.target.value })
                    }
                    rows={3}
                    className="w-full text-xs text-gray-800 p-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-[#F97316]"
                  />
                </div>
              </div>

              {/* Acceptance Criteria (Testable Numbered List) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-gray-700">Testable Acceptance Criteria</label>
                  <button
                    onClick={() =>
                      setSelectedReq({
                        ...selectedReq,
                        acceptance_criteria: [
                          ...selectedReq.acceptance_criteria,
                          `${selectedReq.acceptance_criteria.length + 1}. `,
                        ],
                      })
                    }
                    className="text-[11px] text-[#F97316] font-semibold hover:underline cursor-pointer"
                  >
                    + Add Criterion
                  </button>
                </div>

                <div className="space-y-2">
                  {selectedReq.acceptance_criteria.map((crit, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={crit}
                        onChange={(e) => {
                          const updated = [...selectedReq.acceptance_criteria];
                          updated[idx] = e.target.value;
                          setSelectedReq({ ...selectedReq, acceptance_criteria: updated });
                        }}
                        className="flex-1 text-xs text-gray-800 p-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-[#F97316]"
                      />
                      <button
                        onClick={() => {
                          const updated = selectedReq.acceptance_criteria.filter((_, i) => i !== idx);
                          setSelectedReq({ ...selectedReq, acceptance_criteria: updated });
                        }}
                        className="p-1.5 text-gray-400 hover:text-red-500 rounded"
                        title="Delete criterion"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Priority & Rationale */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-gray-100">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Suggested Priority</label>
                  <select
                    value={selectedReq.priority}
                    onChange={(e) =>
                      setSelectedReq({
                        ...selectedReq,
                        priority: e.target.value as RequirementPriority,
                      })
                    }
                    className="w-full text-xs p-2 rounded-lg border border-gray-200 bg-white font-bold text-[#1F2937]"
                  >
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 mb-1">Priority Rationale</label>
                  <textarea
                    value={selectedReq.priority_rationale}
                    onChange={(e) =>
                      setSelectedReq({ ...selectedReq, priority_rationale: e.target.value })
                    }
                    rows={2}
                    className="w-full text-xs text-gray-800 p-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-[#F97316]"
                  />
                </div>
              </div>

              {/* Supporting Feedback Traceability */}
              <div className="pt-2 border-t border-gray-100">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block mb-2">
                  Traceable Supporting Feedback IDs ({selectedReq.supporting_feedback_ids.length})
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedReq.supporting_feedback_ids.map((id) => (
                    <span
                      key={id}
                      onClick={() => navigate('/admin/feedback')}
                      className="px-2 py-1 rounded bg-gray-100 hover:bg-orange-100 text-[#1F2937] hover:text-[#F97316] font-mono text-[11px] font-medium transition-colors cursor-pointer"
                    >
                      {id}
                    </span>
                  ))}
                </div>
              </div>

              {/* Jira Readiness Note */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-2.5">
                <Layers className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-800">Jira Integration Architecture Ready: </strong>
                  Fields match Jira Epic/Issue schemas (User Story, Acceptance Criteria, Priority, Rationale). When Jira OAuth/API connector is enabled in Settings, approved requirements can sync directly to Jira Backlogs.
                </div>
              </div>
            </>
          ) : (
            <div className="py-24 text-center text-gray-400 text-xs">
              Select a requirement on the left to edit and review.
            </div>
          )}
        </div>
      </div>

      {/* Review & Approval Modal */}
      {showReviewModal && selectedReq && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xl max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-[#1F2937]">Review Requirement Specification</h3>
            <p className="text-xs text-gray-500">
              Set official governance status for <strong className="text-gray-800">{selectedReq.title}</strong>.
            </p>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Status Decision</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'Approved', label: 'Approve Specification', color: 'text-green-700 bg-green-50 border-green-200' },
                  { id: 'Needs Investigation', label: 'Needs Investigation', color: 'text-blue-700 bg-blue-50 border-blue-200' },
                  { id: 'Revision Requested', label: 'Request Revision', color: 'text-amber-700 bg-amber-50 border-amber-200' },
                  { id: 'Rejected', label: 'Reject Requirement', color: 'text-red-700 bg-red-50 border-red-200' },
                ].map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setReviewAction(st.id as any)}
                    className={`p-2.5 text-xs font-bold rounded-xl border text-left transition-all ${
                      reviewAction === st.id ? `${st.color} ring-2 ring-[#F97316]` : 'bg-gray-50 text-gray-600 border-gray-200'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Reviewer Notes / Feedback (Optional)
              </label>
              <textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="e.g. Approved for Sprint 42. Engineering team will prioritize the idempotency webhook mechanism."
                rows={3}
                className="w-full text-xs p-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-[#F97316]"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyReview}
                disabled={saving}
                className="px-5 py-2 text-xs font-semibold text-white bg-[#F97316] hover:bg-[#EA580C] rounded-lg shadow-sm"
              >
                {saving ? 'Saving...' : 'Confirm Review Decision'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
