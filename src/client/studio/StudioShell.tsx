import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";
import { I } from "../components/Icons.js";
import { Logo } from "../components/Logo.js";
import { ThemeToggle } from "../components/ThemeToggle.js";
import "./studio.css";

type StudioShellVariant = "topbar" | "sidebar";
type StudioShellProps = { children: ReactNode; variant?: StudioShellVariant };

const TOP_NAV: { to: string; label: string; match: (path: string) => boolean }[] = [
  { to: "/", label: "Studio", match: (p) => p === "/" },
  { to: "/projects", label: "Projects", match: (p) => p === "/projects" },
  { to: "/websites", label: "Websites", match: (p) => p === "/websites" || p.startsWith("/sites/") },
  { to: "/studio/design", label: "Design", match: (p) => p.startsWith("/studio/design") },
  { to: "/studio/photo", label: "Photo", match: (p) => p.startsWith("/studio/photo") || p === "/studio/compress" },
  { to: "/library", label: "Library", match: (p) => p === "/library" },
  { to: "/templates", label: "Templates", match: (p) => p === "/templates" },
  { to: "/brand-kits", label: "Brand", match: (p) => p === "/brand-kits" },
];

const SIDE_NAV: { to: string; label: string; icon: ReactNode; soon?: boolean; match: (path: string) => boolean }[] = [
  { to: "/", label: "Home", icon: <I.home />, match: (p) => p === "/" },
  { to: "/projects", label: "My Projects", icon: <I.layers />, match: (p) => p === "/projects" },
  { to: "/templates", label: "Templates", icon: <I.sections />, match: (p) => p === "/templates" },
  { to: "/studio/design", label: "Design Studio", icon: <I.elements />, match: (p) => p.startsWith("/studio/design") },
  { to: "/studio/photo", label: "Photo Editor", icon: <I.image />, match: (p) => p.startsWith("/studio/photo") },
  { to: "/studio/compress", label: "Image Compressor", icon: <I.down />, match: (p) => p === "/studio/compress" },
  { to: "/library", label: "Asset Library", icon: <I.inbox />, match: (p) => p === "/library" },
  { to: "/brand-kits", label: "Brand Kits", icon: <I.palette />, match: (p) => p === "/brand-kits" },
  { to: "/studio/convert", label: "File Converter", icon: <I.history />, soon: true, match: (p) => p === "/studio/convert" },
  { to: "/studio/forms", label: "Form Builder", icon: <I.pages />, soon: true, match: (p) => p === "/studio/forms" },
];

export function StudioShell({ children, variant = "topbar" }: StudioShellProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);
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

  if (variant === "sidebar") {
    return (
      <div className={`binhi-studio binhi-studio-sidebar${navOpen ? " nav-open" : ""}`}>
        <button type="button" className={`studio-sidebar-backdrop${navOpen ? " open" : ""}`} aria-label="Close navigation menu" onClick={() => setNavOpen(false)} />
        <aside className="studio-sidebar" aria-label="Binhi navigation">
          <Link to="/" className="studio-sidebar-brand" aria-label="BINHI studio home">
            <Logo />
          </Link>
          <nav className="studio-side-nav" id="studio-sidebar-nav" aria-label="Studio tools">
            {SIDE_NAV.map((item) => (
              <Link key={item.to} to={item.to} aria-current={item.match(location.pathname) ? "page" : undefined} className="studio-side-link">
                <span className="studio-side-icon" aria-hidden="true">{item.icon}</span>
                <span>{item.label}</span>
                {item.soon ? <span className="studio-side-soon">Soon</span> : null}
              </Link>
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

  return (
    <div className="binhi-studio">
      <header className="studio-header">
        <Link to="/" className="studio-brand" aria-label="BINHI studio home">
          <Logo />
        </Link>
        <nav className="studio-nav" aria-label="Studio">
          {TOP_NAV.map((item) => (
            <Link key={item.to} to={item.to} aria-current={item.match(location.pathname) ? "page" : undefined}>{item.label}</Link>
          ))}
        </nav>
        <nav className="studio-account" aria-label="Account">
          <ThemeToggle />
          <Link to="/account" className="btn btn-ghost studio-user">{accountName}</Link>
          <button className="btn btn-ghost" onClick={signOut}>Sign out</button>
        </nav>
      </header>
      {children}
    </div>
  );
}
