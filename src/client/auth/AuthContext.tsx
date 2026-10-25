import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, type User } from "../api.js";

interface AuthState {
  user: User | null;
  loading: boolean;
  signupEnabled: boolean;
  /** False when the deployment has switched the icon library entry points off (BINHI_ICON_LIBRARY=false). */
  iconLibrary: boolean;
  refresh: () => Promise<void>;
  setUser: (u: User | null) => void;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [signupEnabled, setSignupEnabled] = useState(true);
  const [iconLibrary, setIconLibrary] = useState(true);
  const refresh = useCallback(async () => {
    try {
      const r = await api.me();
      setUser(r.user);
      setSignupEnabled(r.signupEnabled);
      setIconLibrary(r.features?.iconLibrary ?? true);
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
    await api.logout();
    setUser(null);
  }, []);
  const value = useMemo(() => ({ user, loading, signupEnabled, iconLibrary, refresh, setUser, logout }), [user, loading, signupEnabled, iconLibrary, refresh, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}
