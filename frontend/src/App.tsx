import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useStore } from './lib/store';
import { LoginPage } from './pages/LoginPage';
import { AuthErrorPage } from './pages/AuthErrorPage';
import { BoardPage } from './pages/BoardPage';
import { SubmitPage } from './pages/SubmitPage';
import { AdminPage } from './pages/AdminPage';
import { AuthCallbackPage } from './pages/AuthCallbackPage';
import { Layout } from './components/Layout';

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) {
  const user = useStore((s) => s.user);
  const initialized = useStore((s) => s.initialized);

  if (!initialized) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-text-muted">Loading...</p>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
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
        <Route path="/auth/error" element={<AuthErrorPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
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
