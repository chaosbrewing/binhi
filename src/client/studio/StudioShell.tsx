import type { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";
import { Logo } from "../components/Logo.js";
import { ThemeToggle } from "../components/ThemeToggle.js";
import "./studio.css";

type StudioShellProps = { children: ReactNode };

const NAV: { to: string; label: string; match: (path: string) => boolean }[] = [
  { to: "/", label: "Studio", match: (p) => p === "/" },
  { to: "/projects", label: "Projects", match: (p) => p === "/projects" },
  { to: "/websites", label: "Websites", match: (p) => p === "/websites" || p.startsWith("/sites/") },
  { to: "/studio/design", label: "Design", match: (p) => p.startsWith("/studio/design") },
  { to: "/studio/photo", label: "Photo", match: (p) => p.startsWith("/studio/photo") || p === "/studio/compress" },
  { to: "/library", label: "Library", match: (p) => p === "/library" },
  { to: "/templates", label: "Templates", match: (p) => p === "/templates" },
  { to: "/brand-kits", label: "Brand", match: (p) => p === "/brand-kits" },
];

export function StudioShell({ children }: StudioShellProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <div className="binhi-studio">
      <header className="studio-header">
        <Link to="/" className="studio-brand" aria-label="BINHI studio home">
          <Logo />
        </Link>
        <nav className="studio-nav" aria-label="Studio">
          {NAV.map((item) => (
            <Link key={item.to} to={item.to} aria-current={item.match(location.pathname) ? "page" : undefined}>{item.label}</Link>
          ))}
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
