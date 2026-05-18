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
import { ManageProject } from './pages/ManageProject';
import { MoleculesPreview } from './pages/MoleculesPreview';
import { Notifications } from './pages/Notifications';
import { NotificationSettings } from './pages/NotificationSettings';
import { OrganismsPreview } from './pages/OrganismsPreview';
import { Profile } from './pages/Profile';
import { NotFound } from './pages/NotFound';
import { ScreensPreview } from './pages/ScreensPreview';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public screen preview — no auth or Supabase required */}
        <Route path="/screens" element={<ScreensPreview />} />
        <Route
          path="*"
          element={
            <AuthProvider>
              <I18nProvider>
                <RoomProvider>
                  <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/auth/callback" element={<AuthCallback />} />
                    <Route path="/atoms" element={<AtomsPreview />} />
                    <Route path="/molecules" element={<MoleculesPreview />} />
                    <Route path="/organisms" element={<OrganismsPreview />} />
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
                      <Route path="/archived-projects" element={<ArchivedProjects />} />
                      <Route path="/notifications" element={<Notifications />} />
                      <Route path="/notifications/settings" element={<NotificationSettings />} />
                    </Route>
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </RoomProvider>
              </I18nProvider>
            </AuthProvider>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
