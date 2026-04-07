import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useStore } from './lib/store';
import { LoginPage } from './pages/LoginPage';
import { SetupPage } from './pages/SetupPage';
import { BoardPage } from './pages/BoardPage';
import { SubmitPage } from './pages/SubmitPage';
import { AdminPage } from './pages/AdminPage';
import { StatsPage } from './pages/StatsPage';
import { ProfilePage } from './pages/ProfilePage';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { Layout } from './components/Layout';

function ProtectedRoute({ children, allowedRoles, skipPasswordCheck }: { children: React.ReactNode; allowedRoles?: string[]; skipPasswordCheck?: boolean }) {
  const user = useStore((s) => s.user);
  const initialized = useStore((s) => s.initialized);
  const mustChangePassword = useStore((s) => s.mustChangePassword);

  if (!initialized) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-text-muted">Loading...</p>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  // Force password change before accessing any page (except the change-password page itself)
  if (mustChangePassword && !skipPasswordCheck) return <Navigate to="/change-password" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-2">403 — Forbidden</h1>
          <p className="text-text-muted">You do not have permission to view this page.</p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

function CatchAll() {
  const user = useStore((s) => s.user);
  const initialized = useStore((s) => s.initialized);
  if (!initialized) return null;
  return <Navigate to={user ? '/board' : '/login'} replace />;
}

export default function App() {
  const fetchUser = useStore((s) => s.fetchUser);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/setup" element={<SetupPage />} />
        <Route
          path="/change-password"
          element={
            <ProtectedRoute skipPasswordCheck>
              <ChangePasswordPage />
            </ProtectedRoute>
          }
        />
        <Route element={<Layout />}>
          <Route
            path="/board"
            element={
              <ProtectedRoute>
                <BoardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/submit"
            element={
              <ProtectedRoute allowedRoles={['decision_maker', 'dev', 'admin']}>
                <SubmitPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/stats"
            element={
              <ProtectedRoute>
                <StatsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminPage />
              </ProtectedRoute>
            }
          />
        </Route>
        <Route path="*" element={<CatchAll />} />
      </Routes>
    </BrowserRouter>
  );
}
