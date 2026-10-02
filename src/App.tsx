import React, { useState, useEffect } from 'react';
import { AdminLayout } from './components/Layout/AdminLayout';
import { CustomerFeedbackForm } from './components/PublicFeedback/CustomerFeedbackForm';
import { OverviewDashboard } from './components/Dashboard/OverviewDashboard';
import { FeedbackManagement } from './components/Feedback/FeedbackManagement';
import { CsvImportWorkspace } from './components/Import/CsvImportWorkspace';
import { AiAnalysisWorkspace } from './components/Analysis/AiAnalysisWorkspace';
import { ProductInsightsWorkspace } from './components/Insights/ProductInsightsWorkspace';
import { RequirementsWorkspace } from './components/Requirements/RequirementsWorkspace';
import { FormManagementWorkspace } from './components/FormManagement/FormManagementWorkspace';
import { ReportsWorkspace } from './components/Reports/ReportsWorkspace';
import { SettingsWorkspace } from './components/Settings/SettingsWorkspace';
import type { AdminUser, GlobalFilterState, RecurringIssue } from './types';

const DEFAULT_ADMIN: AdminUser = {
  id: 'USR-ADMIN-1',
  email: 'admin@paynext.com',
  name: 'Tony Ogbuabor',
  role: 'superadmin',
  created_at: '2026-09-30T10:00:00.000Z',
};

export default function App() {
  const [currentRoute, setCurrentRoute] = useState<string>(() => {
    const path = window.location.pathname;
    if (path === '/' || path === '/admin/login' || path === '/admin') {
      return '/admin/dashboard';
    }
    return path;
  });

  const [adminUser] = useState<AdminUser>(DEFAULT_ADMIN);

  // Cross-screen state transfers
  const [drilldownFilters, setDrilldownFilters] = useState<Partial<GlobalFilterState>>({});
  const [issueForRequirement, setIssueForRequirement] = useState<RecurringIssue | null>(null);

  // Sync with browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const p = window.location.pathname;
      if (p === '/' || p === '/admin/login' || p === '/admin') {
        setCurrentRoute('/admin/dashboard');
      } else {
        setCurrentRoute(p);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (route: string) => {
    const targetRoute = route === '/admin/login' ? '/admin/dashboard' : route;
    window.history.pushState({}, '', targetRoute);
    setCurrentRoute(targetRoute);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 1. PUBLIC CUSTOMER FEEDBACK FORM
  if (currentRoute === '/feedback' || currentRoute === '/feedback/success') {
    return <CustomerFeedbackForm />;
  }

  // 2. ADMIN PORTAL (Direct Access - Login Removed)
  const renderAdminContent = () => {
    switch (currentRoute) {
      case '/admin/dashboard':
        return (
          <OverviewDashboard
            navigate={navigate}
            onFilterDrilldown={(filters) => setDrilldownFilters(filters)}
          />
        );
      case '/admin/feedback':
        return (
          <FeedbackManagement
            initialFilters={drilldownFilters}
            navigate={navigate}
          />
        );
      case '/admin/import':
        return <CsvImportWorkspace navigate={navigate} />;
      case '/admin/analysis':
        return <AiAnalysisWorkspace navigate={navigate} />;
      case '/admin/insights':
        return (
          <ProductInsightsWorkspace
            navigate={navigate}
            onSelectIssueForRequirement={(issue) => setIssueForRequirement(issue)}
          />
        );
      case '/admin/requirements':
        return (
          <RequirementsWorkspace
            initialIssue={issueForRequirement}
            navigate={navigate}
          />
        );
      case '/admin/form-management':
        return <FormManagementWorkspace />;
      case '/admin/reports':
        return <ReportsWorkspace />;
      case '/admin/settings':
        return <SettingsWorkspace adminUser={adminUser} />;
      default:
        return (
          <OverviewDashboard
            navigate={navigate}
            onFilterDrilldown={(filters) => setDrilldownFilters(filters)}
          />
        );
    }
  };

  return (
    <AdminLayout
      currentRoute={currentRoute}
      navigate={navigate}
      adminUser={adminUser}
    >
      {renderAdminContent()}
    </AdminLayout>
  );
}
