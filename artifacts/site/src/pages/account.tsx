import { FormEvent, useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, FileText, Gift, LogOut, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { authApiRequest, createAuthEntryUrl, useAuth, type User } from "@/lib/auth";
import { formatPrice } from "@/lib/format";

type MyOrder = {
  id: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  city: string;
  postalCode: string;
  country: string;
  classroom?: string;
  useDefaultAddress: boolean;
  status: string;
  totalCents: number;
  currency: string;
  createdAt: string;
  items: Array<{ id: number; productName: string; quantity: number; unitPriceCents: number }>;
};

type LoyaltyData = {
  balance: number;
  transactions: Array<{ id: number; points: number; description: string; createdAt: string }>;
};

function getSourceReturnUrl(value: string | null): string | null {
  if (!value) return null;

  try {
    const target = new URL(value);
    if (
      target.origin !== "https://source.afeonbooks.com" ||
      target.username ||
      target.password
    ) {
      return null;
    }
    return target.toString();
  } catch {
    return null;
  }
}

function AccountForm() {
  const { signIn, signUp } = useAuth();
  const [registering, setRegistering] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [forgotMessage, setForgotMessage] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (forgot) {
        const data = await authApiRequest<{ message: string }>("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
        setForgotMessage(data.message);
      } else if (registering) {
        await signUp(name, email, password);
        setForgotMessage("Check your email to verify your account before signing in.");
      } else await signIn(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to continue");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-md space-y-5">
      {!forgot && registering && <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Full name" required className="w-full border border-black/15 bg-white px-4 py-3 outline-none focus:border-black" />}
      <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email address" required className="w-full border border-black/15 bg-white px-4 py-3 outline-none focus:border-black" />
      {!forgot && <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" minLength={8} required className="w-full border border-black/15 bg-white px-4 py-3 outline-none focus:border-black" />}
      {error && <p className="text-sm text-red-700">{error}</p>}
      {forgotMessage && <p className="text-sm text-emerald-700">{forgotMessage}</p>}
      <Button type="submit" disabled={busy} className="w-full rounded-none bg-black py-6 text-xs font-bold uppercase tracking-widest text-white hover:bg-black/80">
        {busy ? "Please wait..." : forgot ? "Send reset link" : registering ? "Create account" : "Sign in"}
      </Button>
      {!registering && <button type="button" onClick={() => { setForgot(!forgot); setError(""); setForgotMessage(""); }} className="w-full text-sm text-black/55 underline underline-offset-4">{forgot ? "Back to sign in" : "Forgot password?"}</button>}
      {!forgot && <button type="button" onClick={() => { setRegistering(!registering); setError(""); }} className="w-full text-sm text-black/55 underline underline-offset-4">
        {registering ? "Already have an account? Sign in" : "New here? Create an account"}
      </button>}
    </form>
  );
}

function AccountTokenHandler() {
  const { user, loading } = useAuth();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [verificationEmail, setVerificationEmail] = useState("");
  const [resendMessage, setResendMessage] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const params = new URLSearchParams(window.location.search);
  const verifyToken = params.get("verify_token");
  const resetToken = params.get("reset_token");

  useEffect(() => {
    if (!verifyToken) return;
    authApiRequest<{ user: User }>("/api/auth/verify-email", { method: "POST", body: JSON.stringify({ token: verifyToken }) })
      .then(() => { window.location.replace("/account"); })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to verify email"));
  }, [verifyToken]);

  const resendVerification = async (event: FormEvent) => {
    event.preventDefault();
    setResendMessage("");
    try {
      const data = await authApiRequest<{ message: string }>("/api/auth/resend-verification", { method: "POST", body: JSON.stringify({ email: verificationEmail }) });
      setResendMessage(data.message);
    } catch (err) {
      setResendMessage(err instanceof Error ? err.message : "Unable to resend verification email");
    }
  };

  if (resetToken) {
    return <form onSubmit={async (event) => { event.preventDefault(); setError(""); try { await authApiRequest<{ user: User }>("/api/auth/reset-password", { method: "POST", body: JSON.stringify({ token: resetToken, password: resetPassword }) }); window.location.replace("/account"); } catch (err) { setError(err instanceof Error ? err.message : "Unable to reset password"); } }} className="mx-auto mt-8 w-full max-w-md space-y-4"><h2 className="text-2xl font-bold">Choose a new password</h2><input type="password" minLength={8} required value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} placeholder="New password" className="w-full border border-black/15 bg-white px-4 py-3" />{error && <p className="text-sm text-red-700">{error}</p>}<Button type="submit" className="w-full rounded-none bg-black py-6 text-xs font-bold uppercase tracking-widest text-white">Update password</Button></form>;
  }
  if (loading || (!verifyToken && !message && !error) || user) return null;
  return <div className="mx-auto mt-8 max-w-md text-sm">{message && <p className="text-emerald-700">{message}</p>}{error && <><p className="text-red-700">{error}</p><form onSubmit={resendVerification} className="mt-5 space-y-3"><input type="email" required value={verificationEmail} onChange={(event) => setVerificationEmail(event.target.value)} placeholder="Email address" className="w-full border border-black/15 bg-white px-4 py-3" /><Button type="submit" variant="outline" className="w-full rounded-none text-xs font-bold uppercase tracking-widest">Resend verification email</Button>{resendMessage && <p className="text-black/60">{resendMessage}</p>}</form></>}</div>;
}

function RoleManager() {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user?.role !== "admin") return;
    authApiRequest<{ users: User[] }>("/api/auth/users").then((data) => setUsers(data.users)).catch((err) => setError(err.message));
  }, [user]);

  if (user?.role !== "admin") return null;

  const updateRole = async (id: number, role: string) => {
    try {
      const data = await authApiRequest<{ user: User }>(`/api/auth/users/${id}/role`, { method: "PATCH", body: JSON.stringify({ role: role || null }) });
      setUsers((current) => current.map((candidate) => candidate.id === id ? data.user : candidate));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update role");
    }
  };

  return (
    <section className="mt-16 border-t border-black/10 pt-10">
      <div className="mb-6 flex items-center gap-3"><ShieldCheck className="h-5 w-5" /><h2 className="text-2xl font-bold">Team access</h2></div>
      {error && <p className="mb-4 text-sm text-red-700">{error}</p>}
      <div className="divide-y divide-black/10 border-y border-black/10">
        {users.map((candidate) => <div key={candidate.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">{candidate.name}</p><p className="text-sm text-black/50">{candidate.email}</p></div><select value={candidate.role === "customer" ? "" : candidate.role} onChange={(event) => updateRole(candidate.id, event.target.value)} disabled={candidate.id === user.id} className="border border-black/15 bg-white px-3 py-2 text-sm"><option value="">Customer</option><option value="staff">Staff</option><option value="admin">Admin</option></select></div>)}
      </div>
    </section>
  );
}

function OrdersPanel() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<MyOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;

    authApiRequest<MyOrder[]>("/api/orders/mine")
      .then((data) => setOrders(data))
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load orders"))
      .finally(() => setLoading(false));
  }, [user]);

  if (!user) return null;

  return (
    <section className="mt-16 border-t border-black/10 pt-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="text-2xl font-bold">Past orders</h2>
      </div>

      {error && <p className="mb-4 text-sm text-red-700">{error}</p>}
      {loading ? (
        <p className="text-black/50">Loading your orders...</p>
      ) : orders.length === 0 ? (
        <p className="text-black/60">You haven’t placed any orders yet.</p>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div key={order.id} className="border border-black/10 bg-white p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-black/40">Order #{order.id}</p>
                  <p className="mt-2 text-sm text-black/60">{new Date(order.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xs font-bold uppercase tracking-[0.2em] text-black/50">{order.status}</span>
                  <span className="text-lg font-bold">{formatPrice(order.totalCents, order.currency)}</span>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-black/60">
                <span>{order.items.reduce((sum, item) => sum + item.quantity, 0)} item(s)</span>
                <span>•</span>
                <span>{order.items.map((item) => item.productName).slice(0, 2).join(", ")}{order.items.length > 2 ? "…" : ""}</span>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <Button asChild variant="outline" className="rounded-none border-black/20 text-xs font-bold uppercase tracking-widest">
                  <Link href={`/order/${order.id}`}>View order</Link>
                </Button>
                <Button type="button" variant="outline" className="rounded-none border-black/20 text-xs font-bold uppercase tracking-widest" onClick={() => window.open(`/order/${order.id}/pdf`, "_blank", "noopener,noreferrer") }>
                  <FileText className="mr-2 h-4 w-4" /> PDF
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function LoyaltyPanel() {
  const { user } = useAuth();
  const [loyalty, setLoyalty] = useState<LoyaltyData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    authApiRequest<LoyaltyData>("/api/auth/loyalty")
      .then(setLoyalty)
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load Pages"));
  }, [user]);

  if (!user) return null;

  return (
    <section className="mt-16 border-t border-black/10 pt-10">
      <div className="flex flex-col gap-5 border border-black/10 bg-white p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <Gift className="mt-1 h-6 w-6" />
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-black/45">Pages</p>
            <h2 className="mt-2 text-2xl font-bold">{(loyalty?.balance ?? 0).toLocaleString()} Pages</h2>
            <p className="mt-2 text-sm text-black/60">Earn 10 Pages for every dollar on completed orders.</p>
          </div>
        </div>
        {(loyalty?.transactions.length ?? 0) > 0 && (
          <div className="text-sm text-black/60 sm:text-right">
            <p className="font-semibold text-black">Latest activity</p>
            <p className="mt-1">+{loyalty!.transactions[0].points} Pages</p>
          </div>
        )}
      </div>
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
    </section>
  );
}

export default function Account() {
  const { user, loading, signOut } = useAuth();
  const params = new URLSearchParams(window.location.search);
  const hasTokenFlow = params.has("reset_token") || params.has("verify_token");
  const returnToParam = params.get("return_to");
  const returnTo = getSourceReturnUrl(returnToParam);
  const isAuthHost = window.location.hostname === "authn.afeonbooks.com";
  const isAuthEntry =
    isAuthHost ||
    window.location.pathname === "/account" ||
    window.location.pathname === "/account/" ||
    /^\/(?:sign-in|account-check)\/[a-f0-9]{32}$/.test(window.location.pathname);

  useEffect(() => {
    if (!loading && !user && !hasTokenFlow && !isAuthEntry) {
      window.location.replace(createAuthEntryUrl(false));
    }
  }, [isAuthEntry, isAuthHost, loading, user, hasTokenFlow]);

  useEffect(() => {
    if (isAuthHost && returnTo && !loading && user?.role === "admin") {
      window.location.replace(returnTo);
    }
  }, [isAuthHost, loading, returnTo, user]);

  if (!loading && !user && !hasTokenFlow && !isAuthEntry) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#FAF7F2]">
      <SiteHeader simple />

      <main className="mx-auto min-h-[70vh] max-w-[900px] px-6 py-16">
        <div className="mb-12">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-black/40">
            AFEON Books
          </p>

          <h1 className="mt-3 text-5xl font-bold tracking-tight">
            Your account
          </h1>
        </div>

        {hasTokenFlow ? (
          <AccountTokenHandler />
        ) : loading ? (
          <p className="text-black/50">Loading...</p>
        ) : isAuthHost && returnToParam && !returnTo ? (
          <p className="mx-auto mt-8 max-w-md text-sm text-red-700">This sign-in destination is not allowed.</p>
        ) : isAuthHost && returnTo && user && user.role !== "admin" ? (
          <div className="mx-auto mt-8 max-w-md text-center text-sm">
            <p className="text-red-700">This page requires an administrator account.</p>
            <Link href="/account" className="mt-3 inline-block underline underline-offset-4">
              Sign out or switch accounts
            </Link>
          </div>
        ) : user ? (
          <>
            <div className="flex flex-col justify-between gap-6 border-y border-black/10 py-8 sm:flex-row sm:items-center">
              <div>
                <p className="text-2xl font-bold">{user.name}</p>
                <p className="mt-1 text-black/55">{user.email}</p>
                <p className="mt-3 text-xs font-bold uppercase tracking-widest text-black/45">
                  {user.role}
                </p>
              </div>

              <Button
                onClick={signOut}
                variant="outline"
                className="w-fit rounded-none border-black/20"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </Button>
            </div>

            <LoyaltyPanel />
            <OrdersPanel />
            <RoleManager />
          </>
        ) : (
          <AccountForm />
        )}

        <Link
          href="/shop"
          className="mt-12 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-widest"
        >
          Continue shopping
          <ArrowRight className="h-4 w-4" />
        </Link>
      </main>

      <SiteFooter />
    </div>
  );
}
