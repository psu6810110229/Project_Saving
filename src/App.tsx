import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './components/AuthProvider/AuthProvider';
import { ProtectedRoute } from './components/ProtectedRoute/ProtectedRoute';
import { RoomProvider } from './components/RoomContext/RoomContext';
import { I18nProvider } from './i18n/I18nProvider';
import { AddMoney } from './pages/AddMoney';
import { AppLayout } from './pages/AppLayout';
import { ArchivedProjects } from './pages/ArchivedProjects';
import { AtomsPreview } from './pages/AtomsPreview';
import { AuthCallback } from './pages/AuthCallback';
import { CheckBalance } from './pages/CheckBalance';
import { Dashboard } from './pages/Dashboard';
import { SavingPlan } from './pages/SavingPlan';
import { Login } from './pages/Login';
import { Maintenance } from './pages/Maintenance';
import { ManageProject } from './pages/ManageProject';
import { MemberDetail } from './pages/MemberDetail';
import { MoleculesPreview } from './pages/MoleculesPreview';
import { Notifications } from './pages/Notifications';
import { NotificationSettings } from './pages/NotificationSettings';
import { OrganismsPreview } from './pages/OrganismsPreview';
import { Profile } from './pages/Profile';
import { NotFound } from './pages/NotFound';
import { DashboardReferenceScreen } from './pages/DashboardReferenceScreen';
import { DashboardBucketsScreen } from './pages/DashboardBucketsScreen';
import { AddMoneyReferenceScreen } from './pages/AddMoneyReferenceScreen';

const MAINTENANCE_MODE = import.meta.env.VITE_MAINTENANCE_MODE === 'true';

function App() {
  if (MAINTENANCE_MODE) {
    return <Maintenance />;
  }

  return (
    <BrowserRouter>
      <AuthProvider>
        <I18nProvider>
        <RoomProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/atoms" element={<AtomsPreview />} />
            <Route path="/molecules" element={<MoleculesPreview />} />
            <Route path="/organisms" element={<OrganismsPreview />} />
            <Route path="/reference/dashboard" element={<DashboardReferenceScreen />} />
            <Route path="/reference/buckets" element={<DashboardBucketsScreen />} />
            <Route path="/reference/add-money" element={<AddMoneyReferenceScreen />} />
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/add" element={<AddMoney />} />
              <Route path="/check-balance" element={<CheckBalance />} />
              <Route path="/saving-plan" element={<SavingPlan />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/manage-project" element={<ManageProject />} />
              <Route path="/members/:userId" element={<MemberDetail />} />
              <Route path="/archived-projects" element={<ArchivedProjects />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/notifications/settings" element={<NotificationSettings />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </RoomProvider>
        </I18nProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
