import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { api, ApiError } from "../api.js";
import type { OAuthIntent, ProviderStatus, SocialProvider } from "../../core/auth.js";
import { useAuth } from "./AuthContext.js";
import { Logo } from "../components/Logo.js";
import { OAuthCallbackNotice } from "./OAuthCallbackNotice.js";
import "./social-auth.css";

function useRedirectTarget(): string {
  const loc = useLocation();
  const from = (loc.state as { from?: string } | null)?.from;
  return from && from.startsWith("/") ? from : "/";
}

function OAuthOptions({ intent }: { intent: Extract<OAuthIntent, "login"> }) {
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [pending, setPending] = useState<SocialProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const result = await api.authProviders();
      setProviders(result.providers);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const begin = async (provider: SocialProvider) => {
    setPending(provider);
    setError(null);
    try {
      const result = await api.startOAuth(provider, intent);
      window.location.assign(result.redirectUrl);
    } catch {
      setError("Could not start sign-in. Please try again.");
      setPending(null);
    }
  };

  return (
    <section className="auth-social" aria-label="Other sign-in options">
      <p className="auth-alt">Or continue with</p>
      {loading ? <p className="muted" role="status">Checking sign-in options…</p> : loadError ? (
        <div><p className="form-error" role="alert">Sign-in options could not be checked.</p><button type="button" className="btn" onClick={() => void load()}>Try again</button></div>
      ) : (
        <div className="auth-social-options">
          {(["google", "apple"] as const).map((id) => {
            const provider = providers.find((item) => item.id === id);
            const label = provider?.label ?? (id === "google" ? "Google" : "Apple");
            return (
              <div key={id}>
                <button type="button" className="btn" disabled={!provider?.available || pending !== null} onClick={() => void begin(id)}>
                  {pending === id ? `Connecting to ${label}…` : `Continue with ${label}`}
                </button>
                {!provider?.available && <span className="muted auth-provider-note">{provider ? "Setup required — this option is not available yet." : "Setup status unavailable."}</span>}
              </div>
            );
          })}
        </div>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
    </section>
  );
}

export function SignIn() {
  const { user, setUser, signupEnabled } = useAuth();
  const nav = useNavigate();
  const target = useRedirectTarget();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to={target} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api.login(email, password);
      setUser(r.user);
      nav(target, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to keep growing your website.">
      <OAuthCallbackNotice />
      <OAuthOptions intent="login" />
      <form onSubmit={submit} className="auth-form" noValidate>
        <label>
          Email
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Password
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
      {signupEnabled && <p className="auth-alt">New here? <Link to="/signup">Create an account</Link></p>}
    </AuthShell>
  );
}

export function SignUp() {
  const { user, setUser, signupEnabled } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/" replace />;
  if (!signupEnabled) return <AuthShell title="Sign-ups are closed" subtitle="This BINHI is private. Ask the owner for an account."><p className="auth-alt"><Link to="/signin">Sign in</Link></p></AuthShell>;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api.signup(email, password, name);
      setUser(r.user);
      nav("/sites/new", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create your account");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Plant your first site" subtitle="A BINHI account keeps your websites, media and publishing history together.">
      <OAuthCallbackNotice />
      <OAuthOptions intent="login" />
      <form onSubmit={submit} className="auth-form" noValidate>
        <label>
          Your name
          <input type="text" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Email
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Password <span className="hint">(at least 10 characters)</span>
          <input type="password" autoComplete="new-password" minLength={10} required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "Creating…" : "Create account"}</button>
      </form>
      <p className="auth-alt">Already have an account? <Link to="/signin">Sign in</Link></p>
    </AuthShell>
  );
}

function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <main className="auth-page">
      <div className="auth-card">
        <Logo />
        <h1>{title}</h1>
        <p className="muted">{subtitle}</p>
        {children}
      </div>
    </main>
  );
}
