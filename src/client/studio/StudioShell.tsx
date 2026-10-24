import type { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";
import { Logo } from "../components/Logo.js";
import { ThemeToggle } from "../components/ThemeToggle.js";
import "./studio.css";

type StudioShellProps = { children: ReactNode };

export function StudioShell({ children }: StudioShellProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isWebsiteRoute = location.pathname === "/websites" || location.pathname.startsWith("/sites/");
  return (
    <div className="binhi-studio">
      <header className="studio-header">
        <Link to="/" className="studio-brand" aria-label="BINHI studio home">
          <Logo />
        </Link>
        <nav className="studio-nav" aria-label="Studio">
          <Link to="/" aria-current={location.pathname === "/" ? "page" : undefined}>Studio</Link>
          <Link to="/websites" aria-current={isWebsiteRoute ? "page" : undefined}>Websites</Link>
          <Link to="/studio/photo" aria-current={location.pathname === "/studio/photo" ? "page" : undefined}>Photo tools</Link>
        </nav>
        <nav className="studio-account" aria-label="Account">
          <ThemeToggle />
          <Link to="/account" className="btn btn-ghost studio-user">{user?.displayName || "Account"}</Link>
          <button className="btn btn-ghost" onClick={() => void logout().then(() => navigate("/signin"))}>Sign out</button>
        </nav>
      </header>
      {children}
    </div>
  );
}
