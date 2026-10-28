import React, { Suspense, lazy, type ReactNode } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext.js";
import { SignIn, SignUp } from "./auth/AuthScreens.js";
import { ToastProvider } from "./components/Toast.js";
import { applyStoredTheme } from "./theme.js";
import { StudioHome } from "./studio/StudioHome.js";
import "./styles/app.css";
import "./studio/studio.css";

applyStoredTheme();

const Dashboard = lazy(() => import("./dashboard/Dashboard.js").then((m) => ({ default: m.Dashboard })));
const NewSite = lazy(() => import("./dashboard/NewSite.js").then((m) => ({ default: m.NewSite })));
const AccountPage = lazy(() => import("./dashboard/AccountPage.js").then((m) => ({ default: m.AccountPage })));
const EditorRoute = lazy(() => import("./editor/EditorRoute.js").then((m) => ({ default: m.EditorRoute })));
const PhotoEditor = lazy(() => import("./studio/photo/PhotoEditor.js").then((m) => ({ default: m.PhotoEditor })));
const ComingSoon = lazy(() => import("./studio/ComingSoon.js").then((m) => ({ default: m.ComingSoon })));
const ProjectsPage = lazy(() => import("./studio/ProjectsPage.js").then((m) => ({ default: m.ProjectsPage })));
const LibraryPage = lazy(() => import("./studio/LibraryPage.js").then((m) => ({ default: m.LibraryPage })));
const TemplatesPage = lazy(() => import("./templates/TemplatesPage.js").then((m) => ({ default: m.TemplatesPage })));
const BrandKitsPage = lazy(() => import("./studio/BrandKitsPage.js").then((m) => ({ default: m.BrandKitsPage })));
const DesignStudioHome = lazy(() => import("./studio/design/DesignStudioHome.js").then((m) => ({ default: m.DesignStudioHome })));
const DesignEditor = lazy(() => import("./studio/design/DesignEditor.js").then((m) => ({ default: m.DesignEditor })));

function RequireAuth({ children }: { children: React.ReactElement }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="page-loading" role="status">Loading…</div>;
  if (!user) return <Navigate to="/signin" state={{ from: loc.pathname }} replace />;
  return children;
}

function DeferredRoute({ children }: { children: ReactNode }) {
  return <Suspense fallback={<div className="page-loading" role="status">Loading…</div>}>{children}</Suspense>;
}

function App() {
  return (
    <Routes>
      <Route path="/signin" element={<SignIn />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/" element={<RequireAuth><StudioHome /></RequireAuth>} />
      <Route path="/projects" element={<RequireAuth><DeferredRoute><ProjectsPage /></DeferredRoute></RequireAuth>} />
      <Route path="/websites" element={<RequireAuth><DeferredRoute><Dashboard /></DeferredRoute></RequireAuth>} />
      <Route path="/library" element={<RequireAuth><DeferredRoute><LibraryPage /></DeferredRoute></RequireAuth>} />
      <Route path="/templates" element={<RequireAuth><DeferredRoute><TemplatesPage /></DeferredRoute></RequireAuth>} />
      <Route path="/brand-kits" element={<RequireAuth><DeferredRoute><BrandKitsPage /></DeferredRoute></RequireAuth>} />
      <Route path="/studio/photo" element={<RequireAuth><DeferredRoute><PhotoEditor mode="photo" /></DeferredRoute></RequireAuth>} />
      <Route path="/studio/photo/:projectId" element={<RequireAuth><DeferredRoute><PhotoEditor mode="photo" /></DeferredRoute></RequireAuth>} />
      <Route path="/studio/compress" element={<RequireAuth><DeferredRoute><PhotoEditor mode="compress" /></DeferredRoute></RequireAuth>} />
      <Route path="/studio/design" element={<RequireAuth><DeferredRoute><DesignStudioHome /></DeferredRoute></RequireAuth>} />
      <Route path="/studio/design/:projectId" element={<RequireAuth><DeferredRoute><DesignEditor /></DeferredRoute></RequireAuth>} />
      <Route path="/studio/convert" element={<RequireAuth><DeferredRoute><ComingSoon tool="convert" /></DeferredRoute></RequireAuth>} />
      <Route path="/studio/forms" element={<RequireAuth><DeferredRoute><ComingSoon tool="forms" /></DeferredRoute></RequireAuth>} />
      <Route path="/sites/new" element={<RequireAuth><DeferredRoute><NewSite /></DeferredRoute></RequireAuth>} />
      <Route path="/sites/:siteId/edit" element={<RequireAuth><DeferredRoute><EditorRoute /></DeferredRoute></RequireAuth>} />
      <Route path="/account" element={<RequireAuth><DeferredRoute><AccountPage /></DeferredRoute></RequireAuth>} />
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
