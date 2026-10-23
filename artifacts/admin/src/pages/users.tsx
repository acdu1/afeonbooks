import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AdminUser = {
  id: number;
  name: string;
  email: string;
  role: string | null;
  pointsBalance: number;
};

async function adminRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({})) as { error?: string } & T;
  if (!response.ok) throw new Error(data.error ?? `Request failed (${response.status})`);
  return data;
}

export default function Users() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingPointsUserId, setEditingPointsUserId] = useState<number | null>(null);
  const [points, setPoints] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      adminRequest<{ users: AdminUser[] }>("/api/auth/users"),
      adminRequest<{ user: { id: number } | null }>("/api/auth/me"),
    ])
      .then(([userData, me]) => {
        if (cancelled) return;
        setUsers(userData.users);
        setCurrentUserId(me.user?.id ?? null);
      })
      .catch((requestError: unknown) => {
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : "Unable to load users");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const updateRole = async (userId: number, role: string) => {
    setError("");
    try {
      const data = await adminRequest<{ user: AdminUser }>(`/api/auth/users/${userId}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role: role || null }),
      });
      setUsers((current) => current.map((user) => user.id === userId ? { ...user, ...data.user } : user));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to update user access");
    }
  };

  const addPoints = async (event: FormEvent, userId: number) => {
    event.preventDefault();
    setError("");
    const amount = Number(points);
    if (!Number.isSafeInteger(amount) || amount < 1) {
      setError("Enter a positive whole number of Pages.");
      return;
    }
    setBusy(true);
    try {
      const data = await adminRequest<{ pointsBalance: number }>(`/api/auth/users/${userId}/loyalty`, {
        method: "POST",
        body: JSON.stringify({ points: amount, description }),
      });
      setUsers((current) => current.map((user) => user.id === userId ? { ...user, pointsBalance: data.pointsBalance } : user));
      setEditingPointsUserId(null);
      setPoints("");
      setDescription("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to add Pages");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-black/40">Admin</p>
        <h2 className="mt-1 text-2xl font-bold">Users</h2>
        <p className="mt-2 text-sm text-black/55">Manage team access and add Pages to customer accounts.</p>
      </div>
      {error && <p role="alert" className="border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {loading ? (
        <p className="text-sm text-black/50">Loading users...</p>
      ) : users.length === 0 ? (
        <p className="text-sm text-black/50">No users found.</p>
      ) : (
        <div className="overflow-x-auto border border-black/5 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-black/[0.02]">
              <tr className="border-b border-black/10">
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-widest">User</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-widest">Pages</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-widest">Team access</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-black/5 last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium">{user.name}</p>
                    <p className="text-xs text-black/50">{user.email}</p>
                  </td>
                  <td className="px-4 py-3 font-semibold">{user.pointsBalance.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <select
                      aria-label={`Team access for ${user.name}`}
                      value={user.role === "customer" ? "" : user.role ?? ""}
                      onChange={(event) => void updateRole(user.id, event.target.value)}
                      disabled={user.id === currentUserId}
                      className="border border-black/15 bg-white px-3 py-2 text-sm disabled:opacity-50"
                    >
                      <option value="">Customer</option>
                      <option value="staff">Staff</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    {editingPointsUserId === user.id ? (
                      <form onSubmit={(event) => void addPoints(event, user.id)} className="flex min-w-[230px] flex-col gap-2">
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          required
                          aria-label="Pages to add"
                          placeholder="Pages"
                          value={points}
                          onChange={(event) => setPoints(event.target.value)}
                        />
                        <Input
                          required
                          maxLength={200}
                          aria-label="Reason for Pages adjustment"
                          placeholder="Reason"
                          value={description}
                          onChange={(event) => setDescription(event.target.value)}
                        />
                        <div className="flex gap-2">
                          <Button type="submit" disabled={busy} className="h-8 rounded-none bg-black px-3 text-xs text-white hover:bg-black/80">
                            {busy ? "Adding..." : "Add Pages"}
                          </Button>
                          <Button type="button" variant="outline" disabled={busy} className="h-8 rounded-none px-3 text-xs" onClick={() => setEditingPointsUserId(null)}>
                            Cancel
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 rounded-none text-xs"
                        onClick={() => {
                          setEditingPointsUserId(user.id);
                          setPoints("");
                          setDescription("");
                        }}
                      >
                        Add Pages
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
