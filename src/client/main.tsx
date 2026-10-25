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
import { StudioHome } from "./studio/StudioHome.js";
import { PhotoEditor } from "./studio/photo/PhotoEditor.js";
import { ComingSoon } from "./studio/ComingSoon.js";
import { ProjectsPage } from "./studio/ProjectsPage.js";
import { LibraryPage } from "./studio/LibraryPage.js";
import { TemplatesPage } from "./studio/TemplatesPage.js";
import { BrandKitsPage } from "./studio/BrandKitsPage.js";
import { DesignStudioHome } from "./studio/design/DesignStudioHome.js";
import { DesignEditor } from "./studio/design/DesignEditor.js";
import "./styles/app.css";
import "./studio/studio.css";

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
      <Route path="/" element={<RequireAuth><StudioHome /></RequireAuth>} />
      <Route path="/projects" element={<RequireAuth><ProjectsPage /></RequireAuth>} />
      <Route path="/websites" element={<RequireAuth><Dashboard /></RequireAuth>} />
      <Route path="/library" element={<RequireAuth><LibraryPage /></RequireAuth>} />
      <Route path="/templates" element={<RequireAuth><TemplatesPage /></RequireAuth>} />
      <Route path="/brand-kits" element={<RequireAuth><BrandKitsPage /></RequireAuth>} />
      <Route path="/studio/photo" element={<RequireAuth><PhotoEditor mode="photo" /></RequireAuth>} />
      <Route path="/studio/photo/:projectId" element={<RequireAuth><PhotoEditor mode="photo" /></RequireAuth>} />
      <Route path="/studio/compress" element={<RequireAuth><PhotoEditor mode="compress" /></RequireAuth>} />
      <Route path="/studio/design" element={<RequireAuth><DesignStudioHome /></RequireAuth>} />
      <Route path="/studio/design/:projectId" element={<RequireAuth><DesignEditor /></RequireAuth>} />
      <Route path="/studio/convert" element={<RequireAuth><ComingSoon tool="convert" /></RequireAuth>} />
      <Route path="/studio/forms" element={<RequireAuth><ComingSoon tool="forms" /></RequireAuth>} />
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
