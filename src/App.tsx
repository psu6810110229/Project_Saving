import { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './components/AuthProvider/AuthProvider';
import { InAppToastProvider } from './components/InAppToast/InAppToastProvider';
import { SplashScreen } from './components/SplashScreen/SplashScreen';
import { ProtectedRoute } from './components/ProtectedRoute/ProtectedRoute';
import { RoomProvider } from './components/RoomContext/RoomContext';
import { I18nProvider } from './i18n/I18nProvider';
import { AppLayout } from './pages/AppLayout';
import { ArchivedProjects } from './pages/ArchivedProjects';
import { AtomsPreview } from './pages/AtomsPreview';
import { AuthCallback } from './pages/AuthCallback';
import { CreateRoom } from './pages/CreateRoom';
import { JoinRoom } from './pages/JoinRoom';
import { Dashboard } from './pages/Dashboard';
import { Team } from './pages/Team';
import { Login } from './pages/Login';
import { Maintenance } from './pages/Maintenance';
import { ManageProject } from './pages/ManageProject';
import { MemberDetail } from './pages/MemberDetail';
import { MoleculesPreview } from './pages/MoleculesPreview';
import { Notifications } from './pages/Notifications';
import { NotificationSettings } from './pages/NotificationSettings';
import { OrganismsPreview } from './pages/OrganismsPreview';
import { WidgetPreview } from './pages/WidgetPreview';
import { Profile } from './pages/Profile';
import { NotFound } from './pages/NotFound';
import { DashboardReferenceScreen } from './pages/DashboardReferenceScreen';
import { DashboardBucketsScreen } from './pages/DashboardBucketsScreen';
import { AddMoneyReferenceScreen } from './pages/AddMoneyReferenceScreen';

const MAINTENANCE_MODE = import.meta.env.VITE_MAINTENANCE_MODE === 'true';

// How long the brand splash stays up on launch before fading out.
const SPLASH_DURATION_MS = 1500;

function App() {
  // Brand splash shows once per app launch (every full load), independent
  // of auth — not on in-app route changes.
  const [showSplash, setShowSplash] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), SPLASH_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

  if (MAINTENANCE_MODE) {
    return <Maintenance />;
  }

  return (
    <>
    <AnimatePresence>{showSplash && <SplashScreen key="splash" />}</AnimatePresence>
    <BrowserRouter>
      <AuthProvider>
        <I18nProvider>
          <InAppToastProvider>
            <RoomProvider>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/atoms" element={<AtomsPreview />} />
                <Route path="/molecules" element={<MoleculesPreview />} />
                <Route path="/organisms" element={<OrganismsPreview />} />
                <Route path="/widget" element={<WidgetPreview />} />
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
                  <Route path="/team" element={<Team />} />
                  <Route path="/add" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/saving-plan" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/manage-project" element={<ManageProject />} />
                  <Route path="/members/:userId" element={<MemberDetail />} />
                  <Route path="/archived-projects" element={<ArchivedProjects />} />
                  <Route path="/notifications" element={<Notifications />} />
                  <Route path="/notifications/settings" element={<NotificationSettings />} />
                  <Route path="/create-room" element={<CreateRoom />} />
                  <Route path="/join-room" element={<JoinRoom />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </RoomProvider>
          </InAppToastProvider>
        </I18nProvider>
      </AuthProvider>
    </BrowserRouter>
    </>
  );
}

export default App;
