import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type User = {
  id: number;
  email: string;
  name: string;
  role: "customer" | "staff" | "admin";
  createdAt: string;
};

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string, turnstileToken: string) => Promise<void>;
  signUp: (name: string, email: string, password: string, turnstileToken: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const apiBaseUrl = import.meta.env.DEV ? (import.meta.env.VITE_API_URL ?? "") : "";

export function createAuthEntryUrl(isAuthenticated: boolean): string {
  if (!import.meta.env.DEV) {
    return "https://authn.afeonbooks.com/account";
  }

  const token = Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const route = isAuthenticated ? "account-check" : "sign-in";
  return `/${route}/${token}`;
}

async function authRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const data = await response.json().catch(() => null) as { error?: string } & T;
  if (!response.ok) {
    const message = typeof data?.error === "string" && data.error
      ? data.error
      : `Request failed with HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}.`;
    throw new Error(message);
  }
  return data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authRequest<{ user: User | null }>("/api/auth/me")
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const signIn = async (email: string, password: string, turnstileToken: string) => {
    const data = await authRequest<{ user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, "cf-turnstile-response": turnstileToken }),
    });
    setUser(data.user);
  };

  const signUp = async (name: string, email: string, password: string, turnstileToken: string) => {
    await authRequest<{ requiresVerification: boolean }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password, "cf-turnstile-response": turnstileToken }),
    });
  };

  const signOut = async () => {
    await authRequest<void>("/api/auth/logout", { method: "POST" });
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}

export async function authApiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  return authRequest<T>(path, options);
}