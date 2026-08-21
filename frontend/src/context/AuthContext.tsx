import { createContext, useContext, useState, ReactNode } from "react";
import { api, User, Organization } from "../api/client";

interface AuthContextValue {
  user: User | null;
  organization: Organization | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, organizationName: string) => Promise<void>;
  oauthLogin: (provider: "google" | "github", customEmail?: string, customName?: string) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const raw = localStorage.getItem("devsight_user");
    return raw ? JSON.parse(raw) : null;
  });

  const [organization, setOrganization] = useState<Organization | null>(() => {
    const raw = localStorage.getItem("devsight_org");
    return raw ? JSON.parse(raw) : null;
  });

  async function login(email: string, password: string) {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("devsight_token", data.token);
    localStorage.setItem("devsight_user", JSON.stringify(data.user));
    if (data.organization) {
      localStorage.setItem("devsight_org", JSON.stringify(data.organization));
      setOrganization(data.organization);
    }
    setUser(data.user);
  }

  async function register(email: string, password: string, name: string, organizationName: string) {
    const { data } = await api.post("/auth/register", { email, password, name, organizationName });
    localStorage.setItem("devsight_token", data.token);
    localStorage.setItem("devsight_user", JSON.stringify(data.user));
    if (data.organization) {
      localStorage.setItem("devsight_org", JSON.stringify(data.organization));
      setOrganization(data.organization);
    }
    setUser(data.user);
  }

  async function oauthLogin(provider: "google" | "github", customEmail?: string, customName?: string) {
    const { data } = await api.post("/auth/oauth", {
      provider,
      email: customEmail,
      name: customName,
    });
    localStorage.setItem("devsight_token", data.token);
    localStorage.setItem("devsight_user", JSON.stringify(data.user));
    if (data.organization) {
      localStorage.setItem("devsight_org", JSON.stringify(data.organization));
      setOrganization(data.organization);
    }
    setUser(data.user);
  }

  async function refreshProfile() {
    try {
      const { data } = await api.get("/auth/me");
      if (data.user) {
        setUser(data.user);
        localStorage.setItem("devsight_user", JSON.stringify(data.user));
      }
      if (data.organization) {
        setOrganization(data.organization);
        localStorage.setItem("devsight_org", JSON.stringify(data.organization));
      }
    } catch (e) {}
  }

  function logout() {
    localStorage.removeItem("devsight_token");
    localStorage.removeItem("devsight_user");
    localStorage.removeItem("devsight_org");
    setUser(null);
    setOrganization(null);
  }

  return (
    <AuthContext.Provider value={{ user, organization, login, register, oauthLogin, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
