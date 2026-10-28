import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";
import { I } from "../components/Icons.js";
import { Logo } from "../components/Logo.js";
import { ThemeToggle } from "../components/ThemeToggle.js";
import { STUDIO_NAVIGATION } from "./navigation.js";
import "./studio.css";

type StudioShellProps = { children: ReactNode; variant?: "topbar" | "sidebar" };

export function StudioShell({ children }: StudioShellProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const accountName = user?.displayName || "Account";
  const accountInitial = accountName.trim().charAt(0).toUpperCase() || "A";

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!navOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNavOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navOpen]);

  const signOut = () => {
    void logout().then(() => navigate("/signin"));
  };

  return (
    <div className={`binhi-studio binhi-studio-sidebar${navOpen ? " nav-open" : ""}${sidebarCollapsed ? " sidebar-collapsed" : ""}`}>
      <button type="button" className={`studio-sidebar-backdrop${navOpen ? " open" : ""}`} aria-label="Close navigation menu" onClick={() => setNavOpen(false)} />
      <aside className="studio-sidebar" aria-label="Binhi navigation">
        <div className="studio-sidebar-heading">
          <Link to="/" className="studio-sidebar-brand" aria-label="BINHI Today">
            <Logo />
          </Link>
          <button type="button" className="icon-btn studio-sidebar-collapse" aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!sidebarCollapsed} onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}>
            <I.chevron />
          </button>
        </div>
        <nav className="studio-side-nav" id="studio-sidebar-nav" aria-label="Primary navigation">
          {STUDIO_NAVIGATION.map((section) => (
            <section className="studio-nav-section" aria-labelledby={`studio-nav-${section.id}`} key={section.id}>
              <span id={`studio-nav-${section.id}`} className="studio-nav-section-label">{section.label}</span>
              {section.items.map((item) => (
              <Link key={item.id} to={item.to} aria-current={item.owns(location.pathname) ? "page" : undefined} className="studio-side-link" title={sidebarCollapsed ? item.label : undefined}>
                <span className="studio-side-icon" aria-hidden="true">{item.icon}</span>
                <span className="studio-side-label">{item.label}</span>
                {item.availability === "planned" ? <span className="studio-side-soon">Planned</span> : null}
              </Link>
              ))}
            </section>
          ))}
        </nav>
      </aside>
      <div className="studio-shell-body">
        <header className="studio-shell-topbar">
          <button type="button" className="icon-btn studio-shell-menu" aria-label="Open navigation menu" aria-controls="studio-sidebar-nav" aria-expanded={navOpen} onClick={() => setNavOpen((open) => !open)}>
            <I.menu />
          </button>
          <nav className="studio-shell-actions" aria-label="Account">
            <ThemeToggle />
            <Link to="/account" className="studio-account-pill" aria-label={`Open account settings for ${accountName}`}>{accountInitial}</Link>
            <button className="btn btn-ghost" onClick={signOut}>Sign out</button>
          </nav>
        </header>
        {children}
      </div>
    </div>
  );
}
