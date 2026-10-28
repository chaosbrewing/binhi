import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError } from "../api.js";
import { useAuth } from "../auth/AuthContext.js";
import { Logo } from "../components/Logo.js";
import { clearPrefs } from "../templates/prefs.js";

export function AccountPage() {
  const { user, setUser } = useAuth();
  const nav = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const del = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.deleteAccount(password);
      if (user) clearPrefs(user.id);
      setUser(null);
      nav("/signin", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete the account");
    }
  };

  return (
    <div className="shell">
      <header className="shell-header">
        <Link to="/" className="plain-link"><Logo /></Link>
        <Link to="/" className="btn btn-ghost">Back to studio</Link>
      </header>
      <main className="shell-main narrow">
        <h1>Your account</h1>
        <dl className="kv">
          <dt>Name</dt><dd>{user?.displayName}</dd>
          <dt>Email</dt><dd>{user?.email}</dd>
        </dl>
        <section className="danger-zone">
          <h2>Delete account</h2>
          <p className="muted">Deleting your account removes every website, image, revision and published page, plus your photo projects, designs, templates, brand kits and asset library. Published sites go offline immediately.</p>
          {!confirming ? (
            <button className="btn btn-danger" onClick={() => setConfirming(true)}>Delete my account…</button>
          ) : (
            <form onSubmit={del} className="auth-form">
              <label>
                Confirm your password
                <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </label>
              {error && <p className="form-error" role="alert">{error}</p>}
              <div className="row gap">
                <button type="button" className="btn" onClick={() => setConfirming(false)}>Cancel</button>
                <button type="submit" className="btn btn-danger">Permanently delete</button>
              </div>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}
