import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './components/AuthProvider/AuthProvider';
import { ProtectedRoute } from './components/ProtectedRoute/ProtectedRoute';
import { RoomProvider } from './components/RoomContext/RoomContext';
import { AddMoney } from './pages/AddMoney';
import { AppLayout } from './pages/AppLayout';
import { AtomsPreview } from './pages/AtomsPreview';
import { AuthCallback } from './pages/AuthCallback';
import { CheckBalance } from './pages/CheckBalance';
import { Dashboard } from './pages/Dashboard';
import { Login } from './pages/Login';
import { ManageProject } from './pages/ManageProject';
import { MoleculesPreview } from './pages/MoleculesPreview';
import { OrganismsPreview } from './pages/OrganismsPreview';
import { Profile } from './pages/Profile';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
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
              <Route path="/profile" element={<Profile />} />
              <Route path="/manage-project" element={<ManageProject />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </RoomProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
