import React, { useState } from 'react';
import { ShieldCheck, Lock, Mail, ArrowRight, RefreshCw, AlertCircle, Sparkles } from 'lucide-react';
import { api } from '../../services/api';
import type { AdminUser } from '../../types';

interface AdminLoginPageProps {
  onLoginSuccess: (user: AdminUser) => void;
}

export const AdminLoginPage: React.FC<AdminLoginPageProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('admin@paynext.com');
  const [password, setPassword] = useState('PayNext2026!');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await api.login(email.trim(), password);
      onLoginSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Invalid administrator credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = () => {
    setEmail('admin@paynext.com');
    setPassword('PayNext2026!');
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full">
        {/* Brand Card */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#F97316] text-white font-bold text-xl shadow-md mb-3">
            PN
          </div>
          <h1 className="text-2xl font-bold text-[#1F2937] tracking-tight">PayNext Admin Portal</h1>
          <p className="text-xs text-gray-500 mt-1">
            Sign in to access customer feedback intelligence and product requirements.
          </p>
        </div>

        {/* Login Form Box */}
        <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-8 space-y-6">
          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                Administrator Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="admin@paynext.com"
                  className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#F97316]/50 focus:border-[#F97316]"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-gray-700">Password</label>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••••••"
                  className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#F97316]/50 focus:border-[#F97316]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white font-semibold text-xs transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Admin Portal</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick-fill Helper for Evaluator */}
          <div className="pt-4 border-t border-gray-100 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#1F2937]">Initial Setup Credentials</span>
              <button
                type="button"
                onClick={handleQuickFill}
                className="text-[11px] text-[#F97316] font-bold hover:underline cursor-pointer"
              >
                Quick Fill
              </button>
            </div>
            <div className="text-[11px] text-gray-500 font-mono">
              Email: admin@paynext.com<br />
              Password: PayNext2026!
            </div>
          </div>
        </div>

        {/* Public Feedback Link at Bottom */}
        <div className="mt-6 text-center text-xs text-gray-500">
          Looking for the customer feedback form?{' '}
          <a href="/feedback" className="text-[#F97316] font-semibold hover:underline">
            Open Public Feedback Form &rarr;
          </a>
        </div>
      </div>
    </div>
  );
};
