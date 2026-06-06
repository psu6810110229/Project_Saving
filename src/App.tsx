import { lazy, Suspense, useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './components/AuthProvider/AuthProvider';
import { InAppToastProvider } from './components/InAppToast/InAppToastProvider';
import { SplashScreen } from './components/SplashScreen/SplashScreen';
import { ProtectedRoute } from './components/ProtectedRoute/ProtectedRoute';
import { DeepLinkListener } from './components/DeepLinkListener/DeepLinkListener';
import { NativePushBootstrap } from './components/Notifications/NativePushBootstrap';
import { RoomProvider } from './components/RoomContext/RoomContext';
import { I18nProvider } from './i18n/I18nProvider';
import { useAppHeight } from './hooks/useAppHeight';

const MAINTENANCE_MODE = import.meta.env.VITE_MAINTENANCE_MODE === 'true';

// How long the brand splash stays up on launch before fading out.
const SPLASH_DURATION_MS = 1500;

const AppLayout = lazy(() => import('./pages/AppLayout').then(module => ({ default: module.AppLayout })));
const ArchivedProjects = lazy(() => import('./pages/ArchivedProjects').then(module => ({ default: module.ArchivedProjects })));
const AtomsPreview = lazy(() => import('./pages/AtomsPreview').then(module => ({ default: module.AtomsPreview })));
const AuthCallback = lazy(() => import('./pages/AuthCallback').then(module => ({ default: module.AuthCallback })));
const CreateRoom = lazy(() => import('./pages/CreateRoom').then(module => ({ default: module.CreateRoom })));
const JoinRoom = lazy(() => import('./pages/JoinRoom').then(module => ({ default: module.JoinRoom })));
const Dashboard = lazy(() => import('./pages/Dashboard').then(module => ({ default: module.Dashboard })));
const Team = lazy(() => import('./pages/Team').then(module => ({ default: module.Team })));
const Login = lazy(() => import('./pages/Login').then(module => ({ default: module.Login })));
const Maintenance = lazy(() => import('./pages/Maintenance').then(module => ({ default: module.Maintenance })));
const ManageProject = lazy(() => import('./pages/ManageProject').then(module => ({ default: module.ManageProject })));
const MemberDetail = lazy(() => import('./pages/MemberDetail').then(module => ({ default: module.MemberDetail })));
const MoleculesPreview = lazy(() => import('./pages/MoleculesPreview').then(module => ({ default: module.MoleculesPreview })));
const Notifications = lazy(() => import('./pages/Notifications').then(module => ({ default: module.Notifications })));
const NotificationSettings = lazy(() => import('./pages/NotificationSettings').then(module => ({ default: module.NotificationSettings })));
const OrganismsPreview = lazy(() => import('./pages/OrganismsPreview').then(module => ({ default: module.OrganismsPreview })));
const WidgetPreview = lazy(() => import('./pages/WidgetPreview').then(module => ({ default: module.WidgetPreview })));
const Profile = lazy(() => import('./pages/Profile').then(module => ({ default: module.Profile })));
const NotFound = lazy(() => import('./pages/NotFound').then(module => ({ default: module.NotFound })));
const DashboardReferenceScreen = lazy(() => import('./pages/DashboardReferenceScreen').then(module => ({ default: module.DashboardReferenceScreen })));
const DashboardBucketsScreen = lazy(() => import('./pages/DashboardBucketsScreen').then(module => ({ default: module.DashboardBucketsScreen })));
const AddMoneyReferenceScreen = lazy(() => import('./pages/AddMoneyReferenceScreen').then(module => ({ default: module.AddMoneyReferenceScreen })));

function RouteFallback() {
  return (
    <div className="flex h-full min-h-[100dvh] items-center justify-center bg-bg" aria-busy="true">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
    </div>
  );
}

function App() {
  // Brand splash shows once per app launch (every full load), independent
  // of auth — not on in-app route changes.
  const [showSplash, setShowSplash] = useState(true);
  // Keep --app-height in sync with the live viewport so the fixed app frame
  // can't clip the bottom nav after a programmatic PWA update reload.
  useAppHeight();
  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), SPLASH_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

  if (MAINTENANCE_MODE) {
    return (
      <Suspense fallback={<RouteFallback />}>
        <Maintenance />
      </Suspense>
    );
  }

  return (
    <>
    <AnimatePresence>{showSplash && <SplashScreen key="splash" />}</AnimatePresence>
    <BrowserRouter>
      <DeepLinkListener />
      <AuthProvider>
        <NativePushBootstrap />
        <I18nProvider>
          <InAppToastProvider>
            <RoomProvider>
              <Suspense fallback={<RouteFallback />}>
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
              </Suspense>
            </RoomProvider>
          </InAppToastProvider>
        </I18nProvider>
      </AuthProvider>
    </BrowserRouter>
    </>
  );
}

export default App;
