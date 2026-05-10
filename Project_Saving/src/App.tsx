import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './components/AuthProvider/AuthProvider';
import { ProtectedRoute } from './components/ProtectedRoute/ProtectedRoute';
import { AppLayout } from './components/AppLayout/AppLayout';
import { Login } from './pages/Login';
import { AuthCallback } from './pages/AuthCallback';
import { BattlePage } from './pages/BattlePage';
import { ProfilePage } from './pages/ProfilePage';
import { GoalPage } from './pages/GoalPage';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Auth pages — no TabBar */}
          <Route path="/login" element={<Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />

          {/* Protected tab pages — with TabBar via AppLayout */}
          <Route
            path="/battle"
            element={
              <AppLayout>
                <BattlePage />
              </AppLayout>
            }
          />
          <Route
            path="/profile"
            element={
              <AppLayout>
                <ProfilePage />
              </AppLayout>
            }
          />
          <Route
            path="/goal"
            element={
              <AppLayout>
                <GoalPage />
              </AppLayout>
            }
          />

          {/* Back-compat redirects */}
          <Route path="/dashboard" element={<ProtectedRoute><Navigate to="/battle" replace /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Navigate to="/profile" replace /></ProtectedRoute>} />

          {/* Default: redirect root → /battle (AppLayout handles auth check) */}
          <Route path="/" element={<Navigate to="/battle" replace />} />

          {/* Unknown routes → /battle */}
          <Route path="*" element={<Navigate to="/battle" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
