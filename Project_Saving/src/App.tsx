import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './components/AuthProvider/AuthProvider';
import { RoomProvider } from './components/RoomContext/RoomContext';
import { ProtectedRoute } from './components/ProtectedRoute/ProtectedRoute';
import { Login } from './pages/Login';
import { AuthCallback } from './pages/AuthCallback';
import { RewriteInProgress } from './pages/RewriteInProgress';
import { AtomsPreview } from './pages/AtomsPreview';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <RoomProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            {/* Dev-only atom catalog — unauth so it's easy to screenshot/diff. */}
            <Route path="/atoms" element={<AtomsPreview />} />

            {/* Placeholder root while the new UI is being rebuilt (Steps 5–7). */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <RewriteInProgress />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </RoomProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
