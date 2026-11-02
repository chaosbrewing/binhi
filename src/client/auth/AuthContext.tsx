import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, type User } from "../api.js";
import { clearPrefs } from "../templates/prefs.js";

interface AuthState {
  user: User | null;
  loading: boolean;
  signupEnabled: boolean;
  refresh: () => Promise<void>;
  setUser: (u: User | null) => void;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [signupEnabled, setSignupEnabled] = useState(true);
  const refresh = useCallback(async () => {
    try {
      const r = await api.me();
      setUser(r.user);
      setSignupEnabled(r.signupEnabled);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const logout = useCallback(async () => {
    const id = user?.id;
    await api.logout();
    if (id) clearPrefs(id);
    setUser(null);
  }, [user]);
  const value = useMemo(() => ({ user, loading, signupEnabled, refresh, setUser, logout }), [user, loading, signupEnabled, refresh, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}
