import React, { useState } from 'react';
import {
  Settings,
  ShieldCheck,
  Sparkles,
  Database,
  Download,
  Upload,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  Trash2,
  Key,
} from 'lucide-react';
import { api } from '../../services/api';
import type { AdminUser } from '../../types';

interface SettingsWorkspaceProps {
  adminUser: AdminUser;
}

export const SettingsWorkspace: React.FC<SettingsWorkspaceProps> = ({ adminUser }) => {
  const [resetPhrase, setResetPhrase] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const handleDownloadBackup = () => {
    const token = localStorage.getItem('paynext_admin_token') || '';
    window.open(`/api/admin/settings/backup?token=${token}`, '_blank');
  };

  const handleExecuteReset = async () => {
    if (resetPhrase !== 'RESET_PAYNEXT_DATA') {
      setResetError('Please type RESET_PAYNEXT_DATA exactly to confirm data reset.');
      return;
    }

    try {
      setResetting(true);
      setResetError(null);
      await api.resetData('RESET_PAYNEXT_DATA');
      setResetSuccess(true);
      setResetPhrase('');
      setTimeout(() => setResetSuccess(false), 4000);
    } catch (err: any) {
      setResetError(err.message || 'Failed to reset database.');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-[#1F2937] tracking-tight flex items-center gap-2">
          <Settings className="w-6 h-6 text-[#F97316]" />
          Platform Settings & Administration
        </h1>
        <p className="text-xs text-gray-500 mt-1">
          Manage system configurations, intelligence models, database backups, and security policies.
        </p>
      </div>

      {/* Admin Profile */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 shadow-2xs space-y-4">
        <h3 className="text-sm font-bold text-[#1F2937] flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-green-600" />
          Active Administrator Profile
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
            <span className="text-gray-400 block text-[10px] uppercase font-bold">Admin Name</span>
            <span className="text-sm font-bold text-[#1F2937]">{adminUser.name}</span>
          </div>

          <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
            <span className="text-gray-400 block text-[10px] uppercase font-bold">Email Address</span>
            <span className="text-sm font-semibold text-gray-700">{adminUser.email}</span>
          </div>

          <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
            <span className="text-gray-400 block text-[10px] uppercase font-bold">Role & Permissions</span>
            <span className="text-sm font-bold text-[#F97316] capitalize">{adminUser.role}</span>
          </div>
        </div>
      </div>

      {/* AI Engine Status */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#1F2937] flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#F97316]" />
            AI Intelligence Model Configuration
          </h3>
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
            Operational
          </span>
        </div>

        <div className="p-4 bg-orange-50/40 rounded-xl border border-orange-100 space-y-2 text-xs">
          <div className="flex items-center justify-between font-semibold text-[#1F2937]">
            <span>Model Alias: gemini-3.8-flash</span>
            <span className="text-[#F97316]">Server-Side Node SDK (@google/genai)</span>
          </div>
          <p className="text-gray-600 leading-relaxed">
            All customer feedback analysis, batch clustering, and product requirement synthesis are performed securely on the server. The Gemini API key is managed via server environment secrets and is never exposed to the client.
          </p>
        </div>
      </div>

      {/* Database Backup & Export */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 shadow-2xs space-y-4">
        <h3 className="text-sm font-bold text-[#1F2937] flex items-center gap-2">
          <Database className="w-4 h-4 text-blue-600" />
          Persistent Storage & Database Snapshot
        </h3>
        <p className="text-xs text-gray-500">
          The PayNext database is persisted to disk in <code>data/paynext_db.json</code> with atomic write locks and automatic session recovery across restarts.
        </p>

        <div>
          <button
            onClick={handleDownloadBackup}
            className="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold text-xs transition-colors inline-flex items-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Download Complete JSON Database Backup</span>
          </button>
        </div>
      </div>

      {/* Danger Zone: Reset Data */}
      <div className="bg-red-50/50 rounded-2xl border border-red-200 p-6 shadow-2xs space-y-4">
        <div className="flex items-center gap-2 text-red-700 font-bold text-sm">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <span>Danger Zone: Reset Platform Data</span>
        </div>
        <p className="text-xs text-red-800/80 leading-relaxed">
          This operation will clear all feedback records, analysis results, recurring issues, and draft product requirements from the database. Administrator accounts will remain active.
        </p>

        {resetSuccess && (
          <div className="p-3 bg-green-100 text-green-900 border border-green-300 rounded-xl text-xs font-semibold">
            All feedback, AI analysis, issues, and requirements have been cleared.
          </div>
        )}

        {resetError && (
          <div className="p-3 bg-red-100 text-red-900 border border-red-300 rounded-xl text-xs font-semibold">
            {resetError}
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <input
            type="text"
            value={resetPhrase}
            onChange={(e) => setResetPhrase(e.target.value)}
            placeholder="Type RESET_PAYNEXT_DATA to confirm"
            className="text-xs p-2.5 rounded-xl border border-red-300 bg-white font-mono focus:outline-none focus:ring-1 focus:ring-red-500 w-full sm:w-80"
          />

          <button
            onClick={handleExecuteReset}
            disabled={resetting || resetPhrase !== 'RESET_PAYNEXT_DATA'}
            className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>{resetting ? 'Resetting...' : 'Permanently Reset Data'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
