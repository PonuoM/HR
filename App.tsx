import React, { useState } from 'react';
import { HashRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import BottomNav from './components/BottomNav';
import Sidebar from './components/Sidebar';
import InstallPrompt from './components/InstallPrompt';
import LoginScreen from './screens/LoginScreen';
import HomeScreen from './screens/HomeScreen';
import CreateRequestScreen from './screens/CreateRequestScreen';
import StatusScreen from './screens/StatusScreen';
import ApprovalHistoryScreen from './screens/ApprovalHistoryScreen';
import LeaveApprovalScreen from './screens/LeaveApprovalScreen';
import NewsScreen from './screens/NewsScreen';
import ProfileScreen from './screens/ProfileScreen';
import PayslipScreen from './screens/PayslipScreen';
import CalendarScreen from './screens/CalendarScreen';
import AdminDashboardScreen from './screens/admin/AdminDashboardScreen';
import AdminEmployeeScreen from './screens/admin/AdminEmployeeScreen';
import AdminContentScreen from './screens/admin/AdminContentScreen';
import AdminPayslipScreen from './screens/admin/AdminPayslipScreen';
import AdminQuotaScreen from './screens/admin/AdminQuotaScreen';
import AdminLocationScreen from './screens/admin/AdminLocationScreen';
import AdminDepartmentScreen from './screens/admin/AdminDepartmentScreen';
import AdminAttendanceReportScreen from './screens/admin/AdminAttendanceReportScreen';
import AdminHolidayScreen from './screens/admin/AdminHolidayScreen';
import AdminCompanyScreen from './screens/admin/AdminCompanyScreen';
import AdminSecurityScreen from './screens/admin/AdminSecurityScreen';
import AdminFaceRegistrationScreen from './screens/admin/AdminFaceRegistrationScreen';
import SettingsScreen from './screens/settings/SettingsScreen';
import SecurityScreen from './screens/settings/SecurityScreen';
import HelpScreen from './screens/settings/HelpScreen';

// Page Transition Wrapper — fade-in + subtle slide-up on every route change
const PageTransition: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  return (
    <div
      key={location.key}
      className="page-transition"
    >
      {children}
    </div>
  );
};

// Redirect to login if not authenticated
const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background-light dark:bg-background-dark">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-500">กำลังโหลด...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Hide mobile bottom nav on create/status pages, admin pages, and settings sub-pages
  const hideBottomNavRoutes = [
    '/request/status',
    '/admin',
  ];

  const shouldHideBottomNav = hideBottomNavRoutes.some(route => location.pathname.startsWith(route));

  return (
    <div className="flex w-full h-full bg-background-light dark:bg-background-dark overflow-hidden">
      {/* Desktop Sidebar */}
      <Sidebar isCollapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(prev => !prev)} />

      {/* Main Content Area — shifts with sidebar on desktop */}
      <div
        className={`flex-1 flex flex-col h-full relative overflow-hidden transition-all duration-300 ease-in-out ${sidebarCollapsed ? 'md:ml-[72px]' : 'md:ml-64'}`}
      >

        {/* Scrollable Content Container */}
        <div className="flex-1 overflow-y-auto scrollbar-hide w-full">
          {children}
        </div>

        {/* Mobile Bottom Nav */}
        {!shouldHideBottomNav && <BottomNav />}

        {/* PWA Install Prompt */}
        <InstallPrompt />
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ToastProvider>
      <AuthProvider>
        <Router>
          <Routes>
            {/* Public Route — Login */}
            <Route path="/login" element={<LoginScreen />} />

            {/* Protected Routes — wrapped in Layout */}
            <Route path="/*" element={
              <RequireAuth>
                <Layout>
                  <PageTransition>
                    <Routes>
                      <Route path="/" element={<HomeScreen />} />
                      <Route path="/news" element={<NewsScreen />} />
                      <Route path="/request/create" element={<CreateRequestScreen />} />
                      <Route path="/request/status/:id" element={<StatusScreen />} />
                      <Route path="/approval/history" element={<ApprovalHistoryScreen />} />
                      <Route path="/leave/history" element={<ApprovalHistoryScreen />} />
                      <Route path="/leave/approvals" element={<LeaveApprovalScreen />} />
                      <Route path="/profile" element={<ProfileScreen />} />

                      {/* Employee Payslips */}
                      <Route path="/payslips" element={<PayslipScreen />} />
                      <Route path="/calendar" element={<CalendarScreen />} />

                      {/* Settings Sub-menus */}
                      <Route path="/settings" element={<SettingsScreen />} />
                      <Route path="/security" element={<SecurityScreen />} />
                      <Route path="/help" element={<HelpScreen />} />

                      {/* Admin Routes */}
                      <Route path="/admin/dashboard" element={<AdminDashboardScreen />} />
                      <Route path="/admin/employees" element={<AdminEmployeeScreen />} />
                      <Route path="/admin/cms" element={<AdminContentScreen />} />
                      <Route path="/admin/payslips" element={<AdminPayslipScreen />} />
                      <Route path="/admin/quotas" element={<AdminQuotaScreen />} />
                      <Route path="/admin/locations" element={<AdminLocationScreen />} />
                      <Route path="/admin/departments" element={<AdminDepartmentScreen />} />
                      <Route path="/admin/attendance-report" element={<AdminAttendanceReportScreen />} />
                      <Route path="/admin/holidays" element={<AdminHolidayScreen />} />
                      <Route path="/admin/companies" element={<AdminCompanyScreen />} />
                      <Route path="/admin/security" element={<AdminSecurityScreen />} />
                      <Route path="/admin/face-registration" element={<AdminFaceRegistrationScreen />} />
                    </Routes>
                  </PageTransition>
                </Layout>
              </RequireAuth>
            } />
          </Routes>
        </Router>
      </AuthProvider>
    </ToastProvider>
  );
};

export default App;