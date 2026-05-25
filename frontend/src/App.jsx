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
      <div className="h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="upload" element={<UploadCenterPage />} />
        <Route path="review" element={<ReviewQueuePage />} />
        <Route path="records/:id" element={<RecordDetailPage />} />
        <Route path="audit" element={<AuditTimelinePage />} />
      </Route>
    </Routes>
  );
}
