import { useEffect, useMemo, useState } from "react";
import "./authn.css";

type User = { id: number; email: string; name: string; role: string; createdAt: string };
type Account = {
  id: number;
  name: string;
  code: string;
  expiresAt: number;
  digits: number;
  period: number;
  algorithm: string;
};

async function api(path: string, options: RequestInit = {}) {
  const response = await fetch(path, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const text = await response.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!response.ok) throw new Error(data?.error || "Something went wrong");
  return data;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [secret, setSecret] = useState("");
  const [accountName, setAccountName] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [now, setNow] = useState(Date.now());

  const load = async () => {
    try {
      const me = await api("/api/auth/me");
      setUser(me.user);
      if (me.user) {
        const result = await api("/api/authenticator");
        setAccounts(result.accounts || []);
      } else {
        setAccounts([]);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load authenticator");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!user || accounts.length === 0) return;
    const nextExpiry = Math.min(...accounts.map((account) => account.expiresAt));
    const delay = Math.max(500, nextExpiry - Date.now() + 100);
    const timer = window.setTimeout(() => void load(), delay);
    return () => window.clearTimeout(timer);
  }, [user, accounts]);

  const secondsLeft = (expiresAt: number) => Math.max(0, Math.ceil((expiresAt - now) / 1000));

  const progress = (account: Account) => {
    const left = secondsLeft(account.expiresAt);
    return Math.min(100, Math.max(0, (left / account.period) * 100));
  };

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setMessage("Code copied.");
      window.setTimeout(() => setMessage(""), 1400);
    } catch {
      setMessage("Copy failed. Select the code manually.");
    }
  };

  const login = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const result = await api("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
      setUser(result.user);
      setPassword("");
      const accountsResult = await api("/api/authenticator");
      setAccounts(accountsResult.accounts || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to sign in");
    } finally {
      setBusy(false);
    }
  };

  const register = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await api("/api/auth/register", { method: "POST", body: JSON.stringify({ email, password, name }) });
      setMessage("Account created. Check your email to verify it, then return here and sign in.");
      setRegistering(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create account");
    } finally {
      setBusy(false);
    }
  };

  const addAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await api("/api/authenticator", {
        method: "POST",
        body: JSON.stringify({ name: accountName, secret }),
      });
      setAccountName("");
      setSecret("");
      setShowAdd(false);
      const result = await api("/api/authenticator");
      setAccounts(result.accounts || []);
      setMessage("Authenticator account added.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to add account");
    } finally {
      setBusy(false);
    }
  };

  const removeAccount = async (id: number) => {
    if (!window.confirm("Remove this authenticator account? The stored TOTP secret will be deleted.")) return;
    setBusy(true);
    try {
      await api(`/api/authenticator/${id}`, { method: "DELETE", body: undefined });
      setAccounts((current) => current.filter((account) => account.id !== id));
      setMessage("Authenticator account removed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to remove account");
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    await api("/api/auth/logout", { method: "POST", body: "{}" }).catch(() => undefined);
    setUser(null);
    setAccounts([]);
  };

  const sorted = useMemo(() => [...accounts].sort((a, b) => a.name.localeCompare(b.name)), [accounts]);

  if (loading) return <div className="screen"><div className="loading">Loading AFEON Authenticator…</div></div>;

  if (!user) {
    return (
      <div className="screen auth-screen">
        <div className="auth-card">
          <div className="brand"><div className="brand-mark">A</div><div><strong>AFEON</strong><span>AUTHENTICATOR</span></div></div>
          <h1>{registering ? "Create your vault" : "Your codes, ready."}</h1>
          <p className="subtle">Securely generate one-time verification codes for the websites you use.</p>
          <form onSubmit={registering ? register : login} className="form">
            {registering && <label>Name<input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required /></label>}
            <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></label>
            <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={registering ? "new-password" : "current-password"} minLength={8} required /></label>
            <button className="primary" disabled={busy}>{busy ? "Please wait…" : registering ? "Create account" : "Sign in"}</button>
          </form>
          {message && <div className="notice">{message}</div>}
          <button className="link" onClick={() => { setRegistering(!registering); setMessage(""); }}>
            {registering ? "Already have an account? Sign in" : "Need an account? Create one"}
          </button>
          <p className="security-note">TOTP secrets are encrypted before they are stored. They are never returned to the browser.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <header className="topbar">
        <div className="brand"><div className="brand-mark">A</div><div><strong>AFEON</strong><span>AUTHENTICATOR</span></div></div>
        <div className="user-area"><span>{user.name}</span><button className="ghost" onClick={logout}>Sign out</button></div>
      </header>

      <main className="content">
        <div className="hero">
          <div><p className="eyebrow">SECURE CODES</p><h1>Your authenticator</h1><p className="subtle">One-time codes for your accounts, refreshed automatically.</p></div>
          <button className="primary add" onClick={() => setShowAdd(true)}>+ Add account</button>
        </div>

        {message && <div className="notice">{message}</div>}

        {showAdd && (
          <div className="panel add-panel">
            <div className="panel-title"><div><h2>Add an account</h2><p>Paste the setup key or the complete <code>otpauth://</code> URI from the website.</p></div><button className="close" onClick={() => setShowAdd(false)}>×</button></div>
            <form onSubmit={addAccount} className="form">
              <label>Account name<input className="allow-select" value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="GitHub, Google, Discord…" maxLength={80} required /></label>
              <label>Setup key or otpauth URI<textarea className="allow-select secret-input" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="JBSWY3DPEHPK3PXP or otpauth://totp/…" rows={3} required /></label>
              <div className="form-actions"><button type="button" className="ghost" onClick={() => setShowAdd(false)}>Cancel</button><button className="primary" disabled={busy}>{busy ? "Adding…" : "Add account"}</button></div>
            </form>
          </div>
        )}

        {sorted.length === 0 && !showAdd && (
          <div className="empty panel"><div className="empty-icon">+</div><h2>No accounts yet</h2><p>Add a TOTP setup key from a website to start generating codes.</p><button className="primary" onClick={() => setShowAdd(true)}>Add your first account</button></div>
        )}

        <div className="accounts">
          {sorted.map((account) => {
            const left = secondsLeft(account.expiresAt);
            return (
              <article className="account panel" key={account.id}>
                <div className="account-head"><div><h2>{account.name}</h2><p>{account.algorithm} · {account.digits} digits · {account.period}s</p></div><button className="danger" onClick={() => void removeAccount(account.id)} disabled={busy}>Remove</button></div>
                <button className="code-button allow-select" onClick={() => void copy(account.code)} aria-label={`Copy code for ${account.name}`}>
                  <span>{account.code}</span><small>Copy</small>
                </button>
                <div className="timer"><div className="timer-track"><div className="timer-fill" style={{ width: `${progress(account)}%` }} /></div><span>{left}s</span></div>
              </article>
            );
          })}
        </div>
      </main>

      <footer>AFEON Authenticator · Keep your recovery codes somewhere safe.</footer>
    </div>
  );
}

export default App;
