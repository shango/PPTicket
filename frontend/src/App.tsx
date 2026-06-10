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
import { ArchivePage } from './pages/ArchivePage';
import { AttachmentsPage } from './pages/AttachmentsPage';
import { MilestonesPage } from './pages/MilestonesPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { TicketDetailPage } from './pages/TicketDetailPage';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { Layout } from './components/Layout';

function ProtectedRoute({ children, allowedRoles, skipPasswordCheck, allowAnonymous }: { children: React.ReactNode; allowedRoles?: string[]; skipPasswordCheck?: boolean; allowAnonymous?: boolean }) {
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
  // Public read-only pages (board, ticket detail) render without an account.
  if (!user) {
    if (allowAnonymous) return <>{children}</>;
    return <Navigate to="/login" replace />;
  }
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
  const initialized = useStore((s) => s.initialized);
  if (!initialized) return null;
  // The board is viewable without an account, so it is the default landing page.
  return <Navigate to="/board" replace />;
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
              <ProtectedRoute allowAnonymous>
                <BoardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tickets/:id"
            element={
              <ProtectedRoute allowAnonymous>
                <TicketDetailPage />
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
            path="/milestones"
            element={
              <ProtectedRoute>
                <MilestonesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/projects"
            element={
              <ProtectedRoute>
                <ProjectsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/attachments"
            element={
              <ProtectedRoute>
                <AttachmentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/archive"
            element={
              <ProtectedRoute allowedRoles={['dev', 'admin']}>
                <ArchivePage />
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
