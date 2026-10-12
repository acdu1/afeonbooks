import { useEffect, useState, type FormEvent } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

type Banner = {
  id: number;
  title: string;
  message: string;
  linkUrl: string;
  linkLabel: string;
  backgroundColor: string;
  textColor: string;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
};

type Promo = {
  id: number;
  code: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  active: boolean;
  expiresAt: string | null;
  maxUses: number | null;
  useCount: number;
};

type BannerDraft = Omit<Banner, "id" | "startsAt" | "endsAt"> & { startsAt: string; endsAt: string };
type PromoDraft = Omit<Promo, "id" | "expiresAt" | "useCount" | "discountValue" | "maxUses"> & {
  expiresAt: string;
  discountValue: string;
  maxUses: string;
};

const bannerBlank: BannerDraft = {
  title: "",
  message: "",
  linkUrl: "",
  linkLabel: "",
  backgroundColor: "#1F4E46",
  textColor: "#FFFFFF",
  active: true,
  startsAt: "",
  endsAt: "",
};

const promoBlank: PromoDraft = {
  code: "",
  discountType: "percent",
  discountValue: "10",
  active: true,
  expiresAt: "",
  maxUses: "",
};

const inputClass = "w-full rounded-none border border-black/15 bg-white px-3 py-2.5 text-sm outline-none focus:border-black";
const labelClass = "block text-xs font-bold uppercase tracking-widest text-black/50";
const buttonClass = "inline-flex items-center justify-center gap-2 rounded-none bg-black px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-white hover:bg-black/80 disabled:opacity-50";

function dateInput(value: string | null) {
  return value ? new Date(value).toISOString().slice(0, 16) : "";
}

function localDate(value: string) {
  return value ? new Date(value).toISOString() : null;
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error ?? `Request failed (${response.status})`);
  return data as T;
}

export default function Marketing() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [promos, setPromos] = useState<Promo[]>([]);
  const [banner, setBanner] = useState<BannerDraft>(bannerBlank);
  const [promo, setPromo] = useState<PromoDraft>(promoBlank);
  const [editingBannerId, setEditingBannerId] = useState<number | null>(null);
  const [editingPromoId, setEditingPromoId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const [bannerList, promoList] = await Promise.all([
        request<Banner[]>("/api/admin/banners"),
        request<Promo[]>("/api/admin/promo-codes"),
      ]);
      setBanners(bannerList);
      setPromos(promoList);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load marketing settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const saveBanner = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const payload = { ...banner, startsAt: localDate(banner.startsAt), endsAt: localDate(banner.endsAt) };
    try {
      await request(editingBannerId ? `/api/admin/banners/${editingBannerId}` : "/api/admin/banners", {
        method: editingBannerId ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      toast.success(editingBannerId ? "Banner updated" : "Banner created");
      setBanner(bannerBlank);
      setEditingBannerId(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save banner");
    } finally {
      setSaving(false);
    }
  };

  const editBanner = (item: Banner) => {
    setEditingBannerId(item.id);
    setBanner({ ...item, startsAt: dateInput(item.startsAt), endsAt: dateInput(item.endsAt) });
    document.getElementById("banner-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const savePromo = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const parsedValue = Number(promo.discountValue);
    const parsedMaxUses = promo.maxUses.trim() ? Number(promo.maxUses) : null;
    const payload = {
      ...promo,
      code: promo.code.trim().toUpperCase(),
      discountValue: promo.discountType === "fixed" ? Math.round(parsedValue * 100) : parsedValue,
      expiresAt: localDate(promo.expiresAt),
      maxUses: parsedMaxUses,
    };
    try {
      await request(editingPromoId ? `/api/admin/promo-codes/${editingPromoId}` : "/api/admin/promo-codes", {
        method: editingPromoId ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      toast.success(editingPromoId ? "Promo code updated" : "Promo code created");
      setPromo(promoBlank);
      setEditingPromoId(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save promo code");
    } finally {
      setSaving(false);
    }
  };

  const editPromo = (item: Promo) => {
    setEditingPromoId(item.id);
    setPromo({
      code: item.code,
      discountType: item.discountType,
      discountValue: item.discountType === "fixed" ? (item.discountValue / 100).toFixed(2) : String(item.discountValue),
      active: item.active,
      expiresAt: dateInput(item.expiresAt),
      maxUses: item.maxUses === null ? "" : String(item.maxUses),
    });
    document.getElementById("promo-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const remove = async (type: "banner" | "promo", id: number) => {
    if (!window.confirm(`Delete this ${type}? This cannot be undone.`)) return;
    const url = type === "banner" ? `/api/admin/banners/${id}` : `/api/admin/promo-codes/${id}`;
    try {
      await request(url, { method: "DELETE" });
      toast.success(`${type === "banner" ? "Banner" : "Promo code"} deleted`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Unable to delete ${type}`);
    }
  };

  const toggleBanner = async (item: Banner) => {
    try {
      await request(`/api/admin/banners/${item.id}`, { method: "PUT", body: JSON.stringify({ ...item, active: !item.active }) });
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update banner");
    }
  };

  const togglePromo = async (item: Promo) => {
    try {
      await request(`/api/admin/promo-codes/${item.id}`, {
        method: "PUT",
        body: JSON.stringify({ ...item, active: !item.active }),
      });
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update promo code");
    }
  };

  return (
    <div className="space-y-12">
      <section className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
        <div>
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-black/40">Storefront</p>
              <h2 className="mt-1 text-2xl font-bold">Banners</h2>
            </div>
            <button type="button" className={buttonClass} onClick={() => { setBanner(bannerBlank); setEditingBannerId(null); }}>
              <Plus size={15} aria-hidden="true" /> New banner
            </button>
          </div>
          <div className="divide-y divide-black/10 border-y border-black/10">
            {loading ? <p className="py-8 text-sm text-black/45">Loading banners...</p> : banners.length === 0 ? (
              <p className="py-8 text-sm text-black/45">No banners created yet.</p>
            ) : banners.map((item) => (
              <article key={item.id} className="flex items-start justify-between gap-4 py-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold">{item.title}</h3>
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${item.active ? "text-emerald-700" : "text-black/35"}`}>{item.active ? "Enabled" : "Disabled"}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-black/55">{item.message}</p>
                  {(item.startsAt || item.endsAt) && <p className="mt-2 text-xs text-black/40">{item.startsAt ? new Date(item.startsAt).toLocaleString() : "Now"} – {item.endsAt ? new Date(item.endsAt).toLocaleString() : "No end date"}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button type="button" className="border border-black/15 px-2.5 py-2 text-xs font-bold uppercase hover:border-black" onClick={() => void toggleBanner(item)}>{item.active ? "Pause" : "Enable"}</button>
                  <button type="button" title="Edit banner" aria-label={`Edit ${item.title}`} className="p-2 text-black/55 hover:text-black" onClick={() => editBanner(item)}><Pencil size={16} /></button>
                  <button type="button" title="Delete banner" aria-label={`Delete ${item.title}`} className="p-2 text-black/45 hover:text-red-700" onClick={() => void remove("banner", item.id)}><Trash2 size={16} /></button>
                </div>
              </article>
            ))}
          </div>
        </div>

        <form id="banner-editor" onSubmit={saveBanner} className="scroll-mt-8 space-y-4 border border-black/10 bg-white p-5 md:p-6">
          <div className="flex items-center justify-between border-b border-black/10 pb-4">
            <h3 className="font-bold">{editingBannerId ? "Edit banner" : "Create banner"}</h3>
            {editingBannerId && <button type="button" aria-label="Cancel editing banner" className="p-1 text-black/45 hover:text-black" onClick={() => { setBanner(bannerBlank); setEditingBannerId(null); }}><X size={17} /></button>}
          </div>
          <label className={labelClass}>Title<input required maxLength={100} className={`${inputClass} mt-2`} value={banner.title} onChange={(event) => setBanner({ ...banner, title: event.target.value })} /></label>
          <label className={labelClass}>Message<textarea required maxLength={500} rows={3} className={`${inputClass} mt-2 resize-y`} value={banner.message} onChange={(event) => setBanner({ ...banner, message: event.target.value })} /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className={labelClass}>Link URL<input className={`${inputClass} mt-2`} placeholder="/shop" value={banner.linkUrl} onChange={(event) => setBanner({ ...banner, linkUrl: event.target.value })} /></label>
            <label className={labelClass}>Link label<input className={`${inputClass} mt-2`} maxLength={40} value={banner.linkLabel} onChange={(event) => setBanner({ ...banner, linkLabel: event.target.value })} /></label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className={labelClass}>Starts at<input type="datetime-local" className={`${inputClass} mt-2`} value={banner.startsAt} onChange={(event) => setBanner({ ...banner, startsAt: event.target.value })} /></label>
            <label className={labelClass}>Ends at<input type="datetime-local" className={`${inputClass} mt-2`} value={banner.endsAt} onChange={(event) => setBanner({ ...banner, endsAt: event.target.value })} /></label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className={labelClass}>Background<input type="color" className="mt-2 h-10 w-full cursor-pointer border border-black/15 bg-white p-1" value={banner.backgroundColor} onChange={(event) => setBanner({ ...banner, backgroundColor: event.target.value })} /></label>
            <label className={labelClass}>Text color<input type="color" className="mt-2 h-10 w-full cursor-pointer border border-black/15 bg-white p-1" value={banner.textColor} onChange={(event) => setBanner({ ...banner, textColor: event.target.value })} /></label>
          </div>
          <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={banner.active} onChange={(event) => setBanner({ ...banner, active: event.target.checked })} /> Enable this banner</label>
          <button type="submit" disabled={saving} className={buttonClass}>{saving ? "Saving..." : editingBannerId ? "Save banner" : "Create banner"}</button>
        </form>
      </section>

      <section className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
        <div>
          <div className="mb-5">
            <p className="text-xs font-bold uppercase tracking-widest text-black/40">Private to administrators</p>
            <h2 className="mt-1 text-2xl font-bold">Promo codes</h2>
          </div>
          <div className="overflow-x-auto border-y border-black/10">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="border-b border-black/10 text-[10px] uppercase tracking-widest text-black/40"><tr><th className="py-3 pr-3">Code</th><th className="py-3 pr-3">Discount</th><th className="py-3 pr-3">Uses</th><th className="py-3 pr-3">Status</th><th className="py-3 text-right">Manage</th></tr></thead>
              <tbody className="divide-y divide-black/10">
                {loading ? <tr><td colSpan={5} className="py-8 text-black/45">Loading promo codes...</td></tr> : promos.length === 0 ? <tr><td colSpan={5} className="py-8 text-black/45">No promo codes created yet.</td></tr> : promos.map((item) => (
                  <tr key={item.id}>
                    <td className="py-4 pr-3 font-mono font-bold">{item.code}</td>
                    <td className="py-4 pr-3">{item.discountType === "percent" ? `${item.discountValue}%` : `$${(item.discountValue / 100).toFixed(2)}`}</td>
                    <td className="py-4 pr-3">{item.useCount}{item.maxUses === null ? "" : ` / ${item.maxUses}`}</td>
                    <td className="py-4 pr-3"><span className={item.active ? "text-emerald-700" : "text-black/40"}>{item.active ? "Active" : "Paused"}</span>{item.expiresAt && new Date(item.expiresAt) < new Date() ? <span className="ml-2 text-red-700">Expired</span> : null}</td>
                    <td className="py-3 text-right"><div className="flex justify-end gap-1"><button type="button" className="border border-black/15 px-2 py-1.5 text-[10px] font-bold uppercase hover:border-black" onClick={() => void togglePromo(item)}>{item.active ? "Pause" : "Enable"}</button><button type="button" title="Edit promo code" aria-label={`Edit ${item.code}`} className="p-2 text-black/55 hover:text-black" onClick={() => editPromo(item)}><Pencil size={15} /></button><button type="button" title="Delete promo code" aria-label={`Delete ${item.code}`} className="p-2 text-black/45 hover:text-red-700" onClick={() => void remove("promo", item.id)}><Trash2 size={15} /></button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <form id="promo-editor" onSubmit={savePromo} className="scroll-mt-8 space-y-4 border border-black/10 bg-white p-5 md:p-6">
          <div className="flex items-center justify-between border-b border-black/10 pb-4">
            <h3 className="font-bold">{editingPromoId ? "Edit promo code" : "Create promo code"}</h3>
            {editingPromoId && <button type="button" aria-label="Cancel editing promo code" className="p-1 text-black/45 hover:text-black" onClick={() => { setPromo(promoBlank); setEditingPromoId(null); }}><X size={17} /></button>}
          </div>
          <label className={labelClass}>Code<input required maxLength={40} pattern="[A-Za-z0-9][A-Za-z0-9_-]{1,39}" className={`${inputClass} mt-2 font-mono uppercase`} placeholder="WELCOME10" value={promo.code} onChange={(event) => setPromo({ ...promo, code: event.target.value.toUpperCase() })} /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className={labelClass}>Discount type<select className={`${inputClass} mt-2`} value={promo.discountType} onChange={(event) => setPromo({ ...promo, discountType: event.target.value as PromoDraft["discountType"] })}><option value="percent">Percent off</option><option value="fixed">Amount off</option></select></label>
            <label className={labelClass}>{promo.discountType === "percent" ? "Percent" : "Amount ($)"}<input required type="number" min={promo.discountType === "percent" ? 1 : 0.01} max={promo.discountType === "percent" ? 100 : undefined} step={promo.discountType === "percent" ? 1 : 0.01} className={`${inputClass} mt-2`} value={promo.discountValue} onChange={(event) => setPromo({ ...promo, discountValue: event.target.value })} /></label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className={labelClass}>Expires at<input type="datetime-local" className={`${inputClass} mt-2`} value={promo.expiresAt} onChange={(event) => setPromo({ ...promo, expiresAt: event.target.value })} /></label>
            <label className={labelClass}>Maximum uses<input type="number" min="1" step="1" className={`${inputClass} mt-2`} placeholder="Unlimited" value={promo.maxUses} onChange={(event) => setPromo({ ...promo, maxUses: event.target.value })} /></label>
          </div>
          <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={promo.active} onChange={(event) => setPromo({ ...promo, active: event.target.checked })} /> Enable this promo code</label>
          <button type="submit" disabled={saving} className={buttonClass}>{saving ? "Saving..." : editingPromoId ? "Save promo code" : "Create promo code"}</button>
        </form>
      </section>
    </div>
  );
}