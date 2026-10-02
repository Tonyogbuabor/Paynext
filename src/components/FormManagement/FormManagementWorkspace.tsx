import React, { useState, useEffect } from 'react';
import {
  Share2,
  Copy,
  ExternalLink,
  Check,
  Save,
  Sliders,
  ShieldCheck,
  Globe,
  QrCode,
  Sparkles,
  Smartphone,
  Eye,
} from 'lucide-react';
import { api } from '../../services/api';
import type { FormConfig } from '../../types';

export const FormManagementWorkspace: React.FC = () => {
  const [config, setConfig] = useState<FormConfig>({
    title: 'PayNext Customer Feedback',
    description: 'Help us build the next generation of financial services.',
    accent_color: '#F97316',
    enable_ratings: true,
    enable_nps: true,
    enable_device_info: true,
    enable_customer_name: true,
    enable_email: true,
    custom_privacy_note: 'PayNext values your feedback to enhance our financial products and services. We will never ask for your passwords, PINs, card numbers, or OTPs.',
    submission_count: 0,
  });

  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [loading, setLoading] = useState(true);

  const publicUrl = `${window.location.origin}/feedback`;

  useEffect(() => {
    api
      .getFormConfig()
      .then((res) => setConfig(res.config))
      .catch((err) => console.error('Failed to load form config:', err))
      .finally(() => setLoading(false));
  }, []);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSaveConfig = async () => {
    try {
      setSaving(true);
      setSaveSuccess(false);
      const res = await api.updateFormConfig(config);
      setConfig(res.config);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save form config:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-[#1F2937] tracking-tight flex items-center gap-2">
          <Share2 className="w-6 h-6 text-[#F97316]" />
          Customer Feedback Form Management
        </h1>
        <p className="text-xs text-gray-500 mt-1">
          Generate, share, and customize the permanent public customer feedback collection portal.
        </p>
      </div>

      {/* Shareable Link Card */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-[#1F2937]">Permanent Public Feedback URL</h3>
            <p className="text-xs text-gray-500">
              Customers can open this link on mobile or desktop without needing an account or password.
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 px-3 py-1 rounded-full border border-green-200">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            Public Endpoint Active
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="flex-1 bg-gray-50 px-4 py-2.5 rounded-xl border border-gray-200 font-mono text-xs text-[#1F2937] select-all truncate">
            {publicUrl}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLink}
              className="px-4 py-2.5 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied to Clipboard!' : 'Copy Form Link'}</span>
            </button>

            <button
              onClick={() => window.open(publicUrl, '_blank')}
              className="px-4 py-2.5 rounded-xl bg-white hover:bg-gray-50 text-gray-700 font-semibold text-xs border border-gray-300 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <ExternalLink className="w-4 h-4 text-gray-500" />
              <span>Preview Form</span>
            </button>
          </div>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 border-t border-gray-100 text-xs">
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
            <span className="text-[10px] uppercase font-bold text-gray-400 block">Submissions Received</span>
            <span className="text-xl font-bold text-[#F97316]">{config.submission_count || 0}</span>
          </div>
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
            <span className="text-[10px] uppercase font-bold text-gray-400 block">Channel Tracking</span>
            <span className="text-sm font-bold text-[#1F2937]">"Web Feedback Form"</span>
          </div>
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 col-span-2 sm:col-span-1">
            <span className="text-[10px] uppercase font-bold text-gray-400 block">Authentication Barrier</span>
            <span className="text-sm font-bold text-green-600">Zero (Public Access)</span>
          </div>
        </div>
      </div>

      {/* Form Content & Settings Customizer */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 shadow-2xs space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div>
            <h3 className="text-sm font-bold text-[#1F2937]">Customization & Field Toggles</h3>
            <p className="text-xs text-gray-500">Configure public form branding, field requirements, and security notices.</p>
          </div>
          <button
            onClick={handleSaveConfig}
            disabled={saving}
            className="px-4 py-2 text-xs font-semibold bg-[#F97316] hover:bg-[#EA580C] text-white rounded-xl shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </div>

        {saveSuccess && (
          <div className="p-3 bg-green-50 text-green-800 border border-green-200 rounded-xl text-xs font-semibold flex items-center gap-2">
            <Check className="w-4 h-4 text-green-600" />
            <span>Form settings saved successfully! Live public form has been updated.</span>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Public Form Heading</label>
            <input
              type="text"
              value={config.title}
              onChange={(e) => setConfig({ ...config, title: e.target.value })}
              className="w-full text-xs p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-1 focus:ring-[#F97316] text-[#1F2937]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Public Subtitle / Explanation</label>
            <textarea
              value={config.description}
              onChange={(e) => setConfig({ ...config, description: e.target.value })}
              rows={2}
              className="w-full text-xs p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-1 focus:ring-[#F97316] text-[#1F2937]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Security & Privacy Notice Banner</label>
            <textarea
              value={config.custom_privacy_note}
              onChange={(e) => setConfig({ ...config, custom_privacy_note: e.target.value })}
              rows={2}
              className="w-full text-xs p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-1 focus:ring-[#F97316] text-[#1F2937]"
            />
          </div>

          <div className="pt-2 border-t border-gray-100">
            <label className="block text-xs font-bold text-gray-700 mb-2">Optional Fields Available on Public Form</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <label className="flex items-center gap-2 p-3 rounded-xl border border-gray-100 bg-gray-50/50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.enable_ratings}
                  onChange={(e) => setConfig({ ...config, enable_ratings: e.target.checked })}
                  className="rounded text-[#F97316] focus:ring-[#F97316]"
                />
                <span className="font-semibold text-gray-700">1 to 5 Star Rating</span>
              </label>

              <label className="flex items-center gap-2 p-3 rounded-xl border border-gray-100 bg-gray-50/50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.enable_nps}
                  onChange={(e) => setConfig({ ...config, enable_nps: e.target.checked })}
                  className="rounded text-[#F97316] focus:ring-[#F97316]"
                />
                <span className="font-semibold text-gray-700">0 to 10 NPS Recommendation Scale</span>
              </label>

              <label className="flex items-center gap-2 p-3 rounded-xl border border-gray-100 bg-gray-50/50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.enable_device_info}
                  onChange={(e) => setConfig({ ...config, enable_device_info: e.target.checked })}
                  className="rounded text-[#F97316] focus:ring-[#F97316]"
                />
                <span className="font-semibold text-gray-700">Technical Context (Device, OS, App Version)</span>
              </label>

              <label className="flex items-center gap-2 p-3 rounded-xl border border-gray-100 bg-gray-50/50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.enable_customer_name}
                  onChange={(e) => setConfig({ ...config, enable_customer_name: e.target.checked })}
                  className="rounded text-[#F97316] focus:ring-[#F97316]"
                />
                <span className="font-semibold text-gray-700">Customer Name & Email Fields</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
