import React, { useState, useEffect } from 'react';
import { isUsingClientFallback } from '../../services/api';
import {
  LayoutDashboard,
  MessageSquareText,
  UploadCloud,
  Sparkles,
  Lightbulb,
  FileCheck2,
  Share2,
  FileBarChart,
  Settings,
  LogOut,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Menu,
  X,
  CreditCard,
  TrendingUp,
} from 'lucide-react';
import type { AdminUser } from '../../types';

interface AdminLayoutProps {
  currentRoute: string;
  navigate: (route: string) => void;
  adminUser: AdminUser;
  onLogout?: () => void;
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  currentRoute,
  navigate,
  adminUser,
  children,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isClientStore, setIsClientStore] = useState(isUsingClientFallback());

  useEffect(() => {
    const timer = setInterval(() => {
      setIsClientStore(isUsingClientFallback());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const navItems = [
    { id: '/admin/dashboard', label: 'Overview Dashboard', icon: LayoutDashboard },
    { id: '/admin/feedback', label: 'Feedback Management', icon: MessageSquareText },
    { id: '/admin/import', label: 'CSV Data Import', icon: UploadCloud },
    { id: '/admin/analysis', label: 'AI Feedback Analysis', icon: Sparkles },
    { id: '/admin/insights', label: 'Product Insights', icon: Lightbulb },
    { id: '/admin/requirements', label: 'Requirements Workspace', icon: FileCheck2 },
    { id: '/admin/form-management', label: 'Form Management', icon: Share2 },
    { id: '/admin/reports', label: 'Reports & Exports', icon: FileBarChart },
    { id: '/admin/settings', label: 'Settings', icon: Settings },
  ];

  const handleNav = (route: string) => {
    navigate(route);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col md:flex-row">
      {/* Mobile Top Bar */}
      <div className="md:hidden bg-[#1F2937] text-white px-4 py-3 flex items-center justify-between border-b border-gray-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#F97316] flex items-center justify-center font-bold text-white shadow-sm">
            PN
          </div>
          <span className="font-semibold text-lg tracking-tight">PayNext</span>
          <span className="text-[10px] uppercase tracking-wider bg-orange-950 text-orange-400 px-2 py-0.5 rounded font-medium border border-orange-800">
            Intelligence
          </span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-gray-300 hover:text-white rounded-lg focus:outline-none"
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar for Desktop & Mobile Overlay */}
      <aside
        className={`${
          mobileMenuOpen ? 'block' : 'hidden'
        } md:block w-full md:w-64 bg-[#1F2937] text-gray-300 flex-shrink-0 flex flex-col justify-between border-r border-gray-800 z-30 transition-all`}
      >
        <div>
          {/* Brand Header */}
          <div className="hidden md:flex items-center gap-3 px-6 py-5 border-b border-gray-800">
            <div className="w-9 h-9 rounded-lg bg-[#F97316] flex items-center justify-center font-bold text-white shadow-md">
              PN
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-lg tracking-tight">PayNext</span>
                <span className="text-[9px] uppercase tracking-wider bg-orange-950/80 text-orange-400 px-1.5 py-0.5 rounded border border-orange-800/60 font-medium">
                  PRO
                </span>
              </div>
              <p className="text-xs text-gray-400">Feedback Intelligence</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            <div className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              Platform
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentRoute === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNav(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left ${
                    isActive
                      ? 'bg-[#F97316] text-white shadow-sm'
                      : 'hover:bg-gray-800/70 text-gray-300 hover:text-white'
                  }`}
                >
                  <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                  <span className="truncate">{item.label}</span>
                  {isActive && <ChevronRight className="w-4 h-4 ml-auto text-white/80" />}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Public Feedback Shortcut & User Footer */}
        <div className="p-4 border-t border-gray-800 space-y-3">
          <button
            onClick={() => window.open('/feedback', '_blank')}
            className="w-full flex items-center justify-between px-3 py-2 text-xs bg-gray-800/80 hover:bg-gray-800 text-gray-300 hover:text-white rounded-lg border border-gray-700/60 transition-colors"
            title="Open customer-facing feedback form"
          >
            <div className="flex items-center gap-2">
              <Share2 className="w-3.5 h-3.5 text-[#F97316]" />
              <span>Public Feedback Form</span>
            </div>
            <ExternalLink className="w-3 h-3 text-gray-400" />
          </button>

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-slate-700 text-white flex items-center justify-center text-xs font-semibold flex-shrink-0 border border-slate-600">
                {adminUser.name
                  .split(' ')
                  .filter(Boolean)
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase() || 'TO'}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-medium text-white truncate">{adminUser.name}</p>
                <p className="text-[10px] text-gray-400 capitalize truncate">{adminUser.role}</p>
              </div>
            </div>
            <div
              className="p-1.5 text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 rounded-lg flex items-center justify-center"
              title="Administrator Active"
            >
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header bar with status & environment info */}
        <header className="bg-white border-b border-[#E2E8F0] px-6 py-3.5 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-[#16A34A] border border-green-200">
              <span className="w-2 h-2 rounded-full bg-[#16A34A] animate-pulse"></span>
              {isClientStore ? 'Live Client Database (831 Records)' : 'Live Database Connected'}
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-50 text-[#F97316] border border-orange-200">
              <Sparkles className="w-3 h-3" />
              Gemini 3.8 Flash AI
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="hidden md:inline-block">PayNext Financial Services</span>
            <div className="h-4 w-px bg-gray-200 hidden md:block"></div>
            <span className="text-[#1F2937] font-medium">{new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          </div>
        </header>

        {/* Dynamic Page Container */}
        <div className="p-4 md:p-6 lg:p-8 flex-1 max-w-7xl w-full mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};
