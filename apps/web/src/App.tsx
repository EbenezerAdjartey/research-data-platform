import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/context/useAuth';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import DashboardLayout from '@/components/DashboardLayout';
import ProjectsPage from '@/pages/ProjectsPage';
import ProjectDetailPage from '@/pages/ProjectDetailPage';
import AnalysisPage from '@/pages/AnalysisPage';
import ReportBuilderPage from '@/pages/ReportBuilderPage';
import DataExplorerPage from '@/pages/DataExplorerPage';
import BillingPage from '@/pages/BillingPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

/** Redirects non-subscribers to /billing when VITE_REQUIRE_SUBSCRIPTION=true. */
function SubscriptionRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const requiresSub = import.meta.env.VITE_REQUIRE_SUBSCRIPTION === 'true';
  if (requiresSub && user && user.subscription_status !== 'active') {
    return <Navigate to="/billing" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <Routes>
                <Route path="/" element={<Navigate to="/projects" replace />} />
                <Route path="/billing" element={<BillingPage />} />
                <Route path="/projects" element={<SubscriptionRoute><ProjectsPage /></SubscriptionRoute>} />
                <Route path="/projects/:id" element={<SubscriptionRoute><ProjectDetailPage /></SubscriptionRoute>} />
                <Route path="/projects/:id/analysis/:analysisId" element={<SubscriptionRoute><AnalysisPage /></SubscriptionRoute>} />
                <Route path="/projects/:id/reports" element={<SubscriptionRoute><ReportBuilderPage /></SubscriptionRoute>} />
                <Route path="/projects/:id/explore/:datasetId" element={<SubscriptionRoute><DataExplorerPage /></SubscriptionRoute>} />
              </Routes>
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
