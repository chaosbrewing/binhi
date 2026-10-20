import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext.js";
import { SignIn, SignUp } from "./auth/AuthScreens.js";
import { Dashboard } from "./dashboard/Dashboard.js";
import { NewSite } from "./dashboard/NewSite.js";
import { AccountPage } from "./dashboard/AccountPage.js";
import { EditorRoute } from "./editor/EditorRoute.js";
import { ToastProvider } from "./components/Toast.js";
import { applyStoredTheme } from "./theme.js";
import "./styles/app.css";

applyStoredTheme();

function RequireAuth({ children }: { children: React.ReactElement }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="page-loading" role="status">Loading…</div>;
  if (!user) return <Navigate to="/signin" state={{ from: loc.pathname }} replace />;
  return children;
}

function App() {
  return (
    <Routes>
      <Route path="/signin" element={<SignIn />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
      <Route path="/sites/new" element={<RequireAuth><NewSite /></RequireAuth>} />
      <Route path="/sites/:siteId/edit" element={<RequireAuth><EditorRoute /></RequireAuth>} />
      <Route path="/account" element={<RequireAuth><AccountPage /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
