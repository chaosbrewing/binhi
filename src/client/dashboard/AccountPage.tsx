import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError } from "../api.js";
import type { AuthMethods, SocialProvider } from "../../core/auth.js";
import { useAuth } from "../auth/AuthContext.js";
import { OAuthCallbackNotice } from "../auth/OAuthCallbackNotice.js";
import { Logo } from "../components/Logo.js";
import "../auth/social-auth.css";

export function AccountPage() {
  const { user, setUser } = useAuth();
  const nav = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [methods, setMethods] = useState<AuthMethods | null>(null);
  const [methodsError, setMethodsError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reauthPassword, setReauthPassword] = useState("");
  const [reauthError, setReauthError] = useState<string | null>(null);

  const refreshMethods = useCallback(async () => {
    setMethodsError(null);
    try {
      setMethods(await api.authMethods());
    } catch {
      setMethodsError("Could not load sign-in methods.");
    }
  }, []);
  useEffect(() => { void refreshMethods(); }, [refreshMethods]);

  const providerLabel = (provider: SocialProvider) =>
    methods?.providers.find((item) => item.id === provider)?.label ?? (provider === "google" ? "Google" : "Apple");

  const reauthenticateWithPassword = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setReauthError(null);
    try {
      await api.reauthenticate(reauthPassword);
      setReauthPassword("");
      await refreshMethods();
    } catch (err) {
      setReauthError(err instanceof ApiError ? err.message : "Could not verify your password.");
    } finally {
      setBusy(false);
    }
  };

  const reauthenticateWithProvider = async (provider: SocialProvider) => {
    setBusy(true);
    setReauthError(null);
    try {
      const result = await api.startOAuth(provider, "reauth");
      window.location.assign(result.redirectUrl);
    } catch {
      setReauthError("Could not start identity verification. Please try again.");
      setBusy(false);
    }
  };

  const linkProvider = async (provider: SocialProvider) => {
    if (!methods?.reauthenticated) {
      setReauthError("Verify your identity before linking a sign-in method.");
      return;
    }
    setBusy(true);
    setReauthError(null);
    try {
      const result = await api.startOAuth(provider, "link");
      window.location.assign(result.redirectUrl);
    } catch {
      setReauthError("Could not start linking. Please try again.");
      await refreshMethods();
      setBusy(false);
    }
  };

  const unlink = async (identityId: string, label: string) => {
    if (!methods?.reauthenticated || !window.confirm(`Disconnect ${label} from your BINHI account?`)) return;
    setBusy(true);
    setError(null);
    try {
      await api.unlinkIdentity(identityId);
      await refreshMethods();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not disconnect this sign-in method.");
    } finally {
      setBusy(false);
    }
  };

  const del = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.deleteAccount(methods?.hasPassword ? password : undefined);
      setUser(null);
      nav("/signin", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete the account");
      await refreshMethods();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="shell">
      <header className="shell-header">
        <Link to="/" className="plain-link"><Logo /></Link>
        <Link to="/" className="btn btn-ghost">Back to studio</Link>
      </header>
      <main className="shell-main narrow">
        <OAuthCallbackNotice />
        <h1>Your account</h1>
        <dl className="kv">
          <dt>Name</dt><dd>{user?.displayName}</dd>
          <dt>Email</dt><dd>{user?.email}</dd>
        </dl>
        <section aria-labelledby="signin-methods-heading">
          <h2 id="signin-methods-heading">Sign-in methods</h2>
          <p className="muted">Keep at least one way to sign in. BINHI protects your last available method from being disconnected.</p>
          {methodsError ? <div><p className="form-error" role="alert">{methodsError}</p><button type="button" className="btn" onClick={() => void refreshMethods()}>Try again</button></div> : !methods ? (
            <p className="muted" role="status">Loading sign-in methods…</p>
          ) : (
            <>
              <ul className="auth-identities">
                {methods.hasPassword && <li><strong>Password</strong><span>Available for this account</span></li>}
                {methods.identities.map((identity) => (
                  <li key={identity.id}>
                    <strong>{providerLabel(identity.provider)}</strong>
                    <span>{identity.email || "Connected"}</span>
                    <button type="button" className="btn" aria-label={`Disconnect ${providerLabel(identity.provider)}`} disabled={busy || !methods.reauthenticated || !identity.canUnlink} onClick={() => void unlink(identity.id, providerLabel(identity.provider))}>
                      Disconnect
                    </button>
                    {!identity.canUnlink && <small className="muted">Keep this method to avoid losing access.</small>}
                  </li>
                ))}
                {methods.identities.length === 0 && !methods.hasPassword && <li>No sign-in methods are currently listed.</li>}
              </ul>
              <div className="auth-social-options">
                {methods.providers.filter((provider) => provider.available && !methods.identities.some((identity) => identity.provider === provider.id)).map((provider) => (
                  <button key={provider.id} type="button" className="btn" disabled={busy || !methods.reauthenticated} onClick={() => void linkProvider(provider.id)}>
                    Link {provider.label}
                  </button>
                ))}
              </div>
              {methods.providers.some((provider) => !provider.available && !methods.identities.some((identity) => identity.provider === provider.id)) && (
                <p className="muted">Some sign-in providers need setup before they can be linked.</p>
              )}
              {reauthError && <p className="form-error" role="alert">{reauthError}</p>}
              {methods.reauthenticated && <p className="muted" role="status">Your identity was recently verified.</p>}
              {!methods.reauthenticated && (
                <div className="auth-reauth">
                  <h3>Verify it’s you</h3>
                  <p className="muted">A recent identity check is required before changing sign-in methods or deleting an OAuth-only account.</p>
                  {methods.hasPassword ? (
                    <form onSubmit={reauthenticateWithPassword} className="auth-form">
                      <label>Verify your password
                        <input type="password" autoComplete="current-password" value={reauthPassword} onChange={(e) => setReauthPassword(e.target.value)} required />
                      </label>
                      <button type="submit" className="btn" disabled={busy || !reauthPassword}>{busy ? "Checking…" : "Verify password"}</button>
                    </form>
                  ) : (
                    <>
                      <p className="muted">Use an already linked provider to verify your identity.</p>
                      <div className="auth-social-options">
                        {methods.identities.filter((identity) => methods.providers.some((provider) => provider.id === identity.provider && provider.available)).map((identity) => (
                          <button key={identity.id} type="button" className="btn" disabled={busy} onClick={() => void reauthenticateWithProvider(identity.provider)}>
                            Verify with {providerLabel(identity.provider)}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </section>
        <section className="danger-zone">
          <h2>Delete account</h2>
          <p className="muted">Deleting your account removes every website, image, revision and published page, plus your photo projects, designs, templates, brand kits and asset library. Published sites go offline immediately.</p>
          {!confirming ? (
            <button className="btn btn-danger" onClick={() => setConfirming(true)}>Delete my account…</button>
          ) : (
            <form onSubmit={del} className="auth-form">
              {methods?.hasPassword ? <label>
                Confirm your password
                <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </label> : <p className="muted">This OAuth-only account can be deleted only after a fresh identity check. You will be asked to confirm the permanent deletion.</p>}
              {error && <p className="form-error" role="alert">{error}</p>}
              <div className="row gap">
                <button type="button" className="btn" onClick={() => { setConfirming(false); setError(null); }}>Cancel</button>
                <button type="submit" className="btn btn-danger" disabled={busy || !methods || (!methods.hasPassword && !methods.reauthenticated)}>Permanently delete</button>
              </div>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}
