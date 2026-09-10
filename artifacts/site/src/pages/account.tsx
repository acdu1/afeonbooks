import { FormEvent, useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, LogOut, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { authApiRequest, useAuth, type User } from "@/lib/auth";

function AccountForm() {
  const { signIn, signUp } = useAuth();
  const [registering, setRegistering] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (registering) await signUp(name, email, password);
      else await signIn(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to continue");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-md space-y-5">
      {registering && <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Full name" required className="w-full border border-black/15 bg-white px-4 py-3 outline-none focus:border-black" />}
      <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email address" required className="w-full border border-black/15 bg-white px-4 py-3 outline-none focus:border-black" />
      <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" minLength={8} required className="w-full border border-black/15 bg-white px-4 py-3 outline-none focus:border-black" />
      {error && <p className="text-sm text-red-700">{error}</p>}
      <Button type="submit" disabled={busy} className="w-full rounded-none bg-black py-6 text-xs font-bold uppercase tracking-widest text-white hover:bg-black/80">
        {busy ? "Please wait..." : registering ? "Create account" : "Sign in"}
      </Button>
      <button type="button" onClick={() => { setRegistering(!registering); setError(""); }} className="w-full text-sm text-black/55 underline underline-offset-4">
        {registering ? "Already have an account? Sign in" : "New here? Create an account"}
      </button>
    </form>
  );
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

export default function Account() {
  const { user, loading, signOut } = useAuth();
  return <div className="min-h-screen bg-[#FAF7F2]"><SiteHeader simple /><main className="mx-auto min-h-[70vh] max-w-[900px] px-6 py-16"><div className="mb-12"><p className="text-xs font-bold uppercase tracking-[0.25em] text-black/40">AFEON Books</p><h1 className="mt-3 text-5xl font-bold tracking-tight">Your account</h1></div>{loading ? <p className="text-black/50">Loading...</p> : user ? <><div className="flex flex-col justify-between gap-6 border-y border-black/10 py-8 sm:flex-row sm:items-center"><div><p className="text-2xl font-bold">{user.name}</p><p className="mt-1 text-black/55">{user.email}</p><p className="mt-3 text-xs font-bold uppercase tracking-widest text-black/45">{user.role}</p></div><Button onClick={signOut} variant="outline" className="w-fit rounded-none border-black/20"><LogOut className="mr-2 h-4 w-4" />Sign out</Button></div><RoleManager /></> : <><p className="mb-8 max-w-md text-black/60">Sign in to view your orders and manage your account. You can also check out as a guest.</p><AccountForm /></>}<Link href="/shop" className="mt-12 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-widest">Continue shopping <ArrowRight className="h-4 w-4" /></Link></main><SiteFooter /></div>;
}