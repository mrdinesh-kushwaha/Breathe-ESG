import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import UploadCenterPage from "./pages/UploadCenterPage";
import ReviewQueuePage from "./pages/ReviewQueuePage";
import RecordDetailPage from "./pages/RecordDetailPage";
import AuditTimelinePage from "./pages/AuditTimelinePage";

function RequireAuth({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-900">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // User nahi hai toh login par bhejo
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function RequireRole({ children, role }) {
  const { user } = useAuth();

  // Role match nahi karta toh dashboard par bhejo
  if (user?.role !== role && user?.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default function App() {
  const { user } = useAuth();

  return (
    <Routes>
      {/* Login page — already logged in hai toh dashboard par jao */}
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <LoginPage />}
      />

      {/* Protected routes — login required */}
      <Route
        path="/"
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />

        {/* Sirf analyst upload kar sakta hai */}
        <Route
          path="upload"
          element={
            <RequireRole role="analyst">
              <UploadCenterPage />
            </RequireRole>
          }
        />

        {/* Sirf reviewer review kar sakta hai */}
        <Route
          path="review"
          element={
            <RequireRole role="reviewer">
              <ReviewQueuePage />
            </RequireRole>
          }
        />

        <Route path="records/:id" element={<RecordDetailPage />} />
        <Route path="audit" element={<AuditTimelinePage />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}