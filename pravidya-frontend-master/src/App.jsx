import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

// Layouts (small, always needed for shell)
import PublicLayout from './layouts/PublicLayout';
import AdminLayout from './layouts/AdminLayout';
import CounselorLayout from './layouts/CounselorLayout';
import ManagementLayout from './layouts/ManagementLayout';
import SuperAdminLayout from './layouts/SuperAdminLayout';
import SuperAdminProtectedRoute from './components/SuperAdminProtectedRoute';
import SuperAdminOnboardingRedirect from './components/SuperAdminOnboardingRedirect';

// Lazy-load pages for faster initial load (code splitting)
const AdmissionForm = lazy(() => import('./pages/public/AdmissionForm'));
const ThankYou = lazy(() => import('./pages/public/ThankYou'));
const ParentFeedbackForm = lazy(() => import('./pages/public/ParentFeedbackForm'));
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const AdminLeads = lazy(() => import('./pages/admin/Leads'));
const CreateLead = lazy(() => import('./pages/admin/CreateLead'));
const EditLead = lazy(() => import('./pages/admin/EditLead'));
const AdminCounselors = lazy(() => import('./pages/admin/Counselors'));
const AdminInstitutions = lazy(() => import('./pages/admin/Institutions'));
const CreateInstitution = lazy(() => import('./pages/admin/CreateInstitution'));
const EditInstitution = lazy(() => import('./pages/admin/EditInstitution'));
const AdminAnalytics = lazy(() => import('./pages/admin/Analytics'));
const AdminSettings = lazy(() => import('./pages/admin/Settings'));
const HistoricalDataVerification = lazy(() => import('./pages/admin/HistoricalDataVerification'));
const TrainingModules = lazy(() => import('./pages/admin/TrainingModules'));
const IntelligenceOnboarding = lazy(() => import('./pages/admin/IntelligenceOnboarding'));
const CounselorDashboard = lazy(() => import('./pages/counselor/Dashboard'));
const ManagementDashboard = lazy(() => import('./pages/management/Dashboard'));
const ManagementOverview = lazy(() => import('./pages/management/Overview'));
const CounselorAnalytics = lazy(() => import('./pages/management/CounselorAnalytics'));
const SchoolAnalytics = lazy(() => import('./pages/management/SchoolAnalytics'));
const LeadBehavior = lazy(() => import('./pages/management/LeadBehavior'));
const Alerts = lazy(() => import('./pages/management/Alerts'));
const Questions = lazy(() => import('./pages/management/Questions'));
const FeedbackAnalytics = lazy(() => import('./pages/management/FeedbackAnalytics'));
const CounselorLeads = lazy(() => import('./pages/counselor/Leads'));
const CounselorSessions = lazy(() => import('./pages/counselor/Sessions'));
const CounselorTraining = lazy(() => import('./pages/counselor/Training'));
const CounselorTodos = lazy(() => import('./pages/counselor/Todos'));
const CounselorSchools = lazy(() => import('./pages/counselor/Schools'));
const CounselorHistoricalInsights = lazy(() => import('./pages/counselor/HistoricalInsights'));
const VoiceCallLeadUpdatePage = lazy(() => import('./pages/counselor/VoiceCallLeadUpdatePage'));
const CounselorIntelligenceChat = lazy(() => import('./pages/counselor/IntelligenceChat'));
const CounselorEmotionalHookAnalytics = lazy(() => import('./pages/counselor/EmotionalHookAnalytics'));
const PravidyaLanding = lazy(() => import('./pages/pravidya/LandingPage'));
const PravidyaEnquiry = lazy(() => import('./pages/pravidya/EnquiryPage'));
const PravidyaLogin = lazy(() => import('./pages/pravidya/LoginPage'));
const PravidyaOTP = lazy(() => import('./pages/pravidya/OTPPage'));
const PravidyaThankYou = lazy(() => import('./pages/pravidya/ThankYouPage'));
const PravidyaForgotPassword = lazy(() => import('./pages/pravidya/ForgotPasswordPage'));
const PravidyaResetPassword = lazy(() => import('./pages/pravidya/ResetPasswordPage'));
const SuperAdminLogin = lazy(() => import('./pages/superAdmin/LoginPage'));
const SuperAdminStaff = lazy(() => import('./pages/superAdmin/Staff'));
const SuperAdminOnboarding = lazy(() => import('./pages/superAdmin/Onboarding'));
const SaasAcademyEntry = lazy(() => import('./pages/saas/AcademyEntry'));
const SaasDashboard = lazy(() => import('./pages/saas/Dashboard'));
const VemanOnboarding = lazy(() => import('./pages/saas/VemanOnboarding'));
const JeetofyOnboarding = lazy(() => import('./pages/saas/JeetofyOnboarding'));
const JeetofyLogin = lazy(() => import('./pages/saas/JeetofyLogin'));

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[50vh]" aria-label="Loading">
    <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-500 border-t-transparent" />
  </div>
);

function App() {
  return (
    <AuthProvider>
      <Router>
        <Toaster position="top-right" />
        <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public Routes - staff login is Pravidya OTP at /pravidya/acme/veeman/login */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Navigate to="/pravidya/acme/veeman" replace />} />
            <Route path="/admission" element={<AdmissionForm />} />
            <Route path="/thank-you" element={<ThankYou />} />
            <Route path="/feedback/:token" element={<ParentFeedbackForm />} />
            <Route path="/admin/login" element={<Navigate to="/pravidya/acme/veeman/login?role=ADMIN" replace />} />
            <Route path="/counselor/login" element={<Navigate to="/pravidya/acme/veeman/login?role=COUNSELOR" replace />} />
            <Route path="/management/login" element={<Navigate to="/pravidya/acme/veeman/login?role=MANAGEMENT" replace />} />
            {/* SaaS Academy onboarding/login (Jeetofy URL: /venam/{academyId}) */}
            <Route path="/venam/:academyId" element={<SaasAcademyEntry />} />
            <Route path="/venam/:academyId/onboarding" element={<VemanOnboarding />} />
            {/* Canonical Jeetofy onboarding + login */}
            <Route path="/academy/:academyId" element={<JeetofyOnboarding />} />
            <Route path="/login" element={<JeetofyLogin />} />
          </Route>

          {/* Admin Routes */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="leads" element={<AdminLeads />} />
            <Route path="leads/create" element={<CreateLead />} />
            <Route path="leads/:id/edit" element={<EditLead />} />
            <Route path="counselors" element={<AdminCounselors />} />
            <Route path="institutions" element={<AdminInstitutions />} />
            <Route path="institutions/create" element={<CreateInstitution />} />
            <Route path="institutions/:id/edit" element={<EditInstitution />} />
            <Route path="courses" element={<Navigate to="/admin/institutions" replace />} />
            <Route path="training" element={<Navigate to="/admin/training-modules" replace />} />
            <Route path="training-modules" element={<TrainingModules />} />
            <Route path="analytics" element={<AdminAnalytics />} />
            <Route path="historical-data" element={<HistoricalDataVerification />} />
            <Route path="intelligence-onboarding" element={<IntelligenceOnboarding />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>

          {/* Management Routes */}
          <Route
            path="/management"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'MANAGEMENT']}>
                <ManagementLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/management/overview" replace />} />
            <Route path="overview" element={<ManagementOverview />} />
            <Route path="counselor-analytics" element={<CounselorAnalytics />} />
            <Route path="school-analytics" element={<SchoolAnalytics />} />
            <Route path="lead-behavior" element={<LeadBehavior />} />
            <Route path="alerts" element={<Alerts />} />
            <Route path="dashboard" element={<ManagementDashboard />} />
            <Route path="questions" element={<Questions />} />
            <Route path="feedback-analytics" element={<FeedbackAnalytics />} />
          </Route>

          {/* Counselor Routes */}
          <Route
            path="/counselor"
            element={
              <ProtectedRoute allowedRoles={['COUNSELOR']}>
                <CounselorLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/counselor/dashboard" replace />} />
            <Route path="dashboard" element={<CounselorDashboard />} />
            <Route path="leads" element={<CounselorLeads />} />
            <Route path="leads/:id" element={<EditLead />} />
            <Route path="leads/create" element={<CreateLead />} />
            <Route path="sessions" element={<CounselorSessions />} />
            <Route path="sessions/voice-call" element={<VoiceCallLeadUpdatePage />} />
            <Route path="emotional-hook-analytics" element={<CounselorEmotionalHookAnalytics />} />
            <Route path="training" element={<CounselorTraining />} />
            <Route path="todos" element={<CounselorTodos />} />
            <Route path="schools" element={<CounselorSchools />} />
            <Route path="historical-insights" element={<CounselorHistoricalInsights />} />
            <Route path="intelligence-chat" element={<CounselorIntelligenceChat />} />
          </Route>

          {/* PRAVIDYA Multi-Tenant Routes */}
          <Route path="/pravidya/:domain/:academySlug" element={<PravidyaLanding />} />
          <Route path="/pravidya/:domain/:academySlug/enquiry" element={<PravidyaEnquiry />} />
          <Route path="/pravidya/:domain/:academySlug/login" element={<PravidyaLogin />} />
          <Route path="/pravidya/:domain/:academySlug/otp" element={<PravidyaOTP />} />
          <Route path="/pravidya/:domain/:academySlug/thank-you" element={<PravidyaThankYou />} />
          <Route path="/pravidya/:domain/:academySlug/forgot-password" element={<PravidyaForgotPassword />} />
          <Route path="/pravidya/:domain/:academySlug/reset-password" element={<PravidyaResetPassword />} />

          {/* SaaS Academy Dashboard (separate auth via saas_token cookie) */}
          <Route path="/venam/:academyId/dashboard" element={<SaasDashboard />} />

          {/* Super Admin Routes */}
          <Route path="/super-admin/login" element={<SuperAdminLogin />} />
          <Route
            path="/super-admin"
            element={
              <SuperAdminProtectedRoute>
                <SuperAdminLayout />
              </SuperAdminProtectedRoute>
            }
          >
            <Route index element={<SuperAdminOnboardingRedirect />} />
            <Route path="dashboard" element={<SuperAdminOnboardingRedirect />} />
            <Route path="institutions" element={<SuperAdminOnboardingRedirect />} />
            {/* Scoped onboarding: /super-admin/onboarding/PRV-F-000018 for Veman Academy flow */}
            <Route path="onboarding/:institutionId" element={<SuperAdminOnboarding />} />
            <Route path="onboarding" element={<SuperAdminOnboarding />} />
            <Route path="staff" element={<SuperAdminStaff />} />
          </Route>

          {/* Catch all - send to Pravidya landing */}
          <Route path="*" element={<Navigate to="/pravidya/acme/veeman" replace />} />
        </Routes>
        </Suspense>
      </Router>
    </AuthProvider>
  );
}

export default App;
