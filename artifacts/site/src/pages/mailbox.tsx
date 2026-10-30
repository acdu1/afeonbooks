import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Archive,
  ArrowLeft,
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  FileText,
  Flag,
  Inbox,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Mail,
  MailOpen,
  Pencil,
  RefreshCw,
  Search,
  Send,
  Star,
  Trash2,
} from "lucide-react";
import { authApiRequest, createAuthEntryUrl, useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ZohoFolder = { id: string; name: string; total?: number; unread?: number };
type ZohoMessage = {
  id: string;
  threadId?: string;
  subject: string;
  sender: string;
  senderAddress: string;
  recipients: string;
  preview: string;
  date: string;
  unread: boolean;
  flagged: boolean;
  raw: Record<string, unknown>;
};
type MailSession = { unlocked: boolean; emailAddress?: string; unlockedUntil?: string };
type ComposeState = { mode: "new" | "reply"; to: string; subject: string; body: string };

const MESSAGE_PAGE_SIZE = 100;
const api = <T,>(path: string, options?: RequestInit) => authApiRequest<T>(path, options);

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function records(value: unknown, hints: string[]): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.map(record);
  const object = record(value);
  for (const key of ["data", ...hints]) {
    const candidate = object[key];
    if (Array.isArray(candidate)) return candidate.map(record);
    const nested = record(candidate);
    for (const hint of hints) {
      if (Array.isArray(nested[hint])) return (nested[hint] as unknown[]).map(record);
    }
  }
  return [];
}

function text(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  return "";
}

function field(item: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) if (item[key] !== undefined && item[key] !== null) return item[key];
  return undefined;
}

function address(value: unknown): { name: string; email: string } {
  if (typeof value === "string") {
    const match = value.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
    return match ? { name: match[1].replace(/^"|"$/g, ""), email: match[2] } : { name: value, email: value };
  }
  if (Array.isArray(value)) return address(value[0]);
  const item = record(value);
  const email = text(field(item, "emailAddress", "address", "email", "mailId"));
  return { name: text(field(item, "name", "displayName", "personalName")) || email, email };
}

function normalizeFolders(payload: unknown): ZohoFolder[] {
  return records(payload, ["folders", "folderDetails", "folderList"]).map((item) => ({
    id: text(field(item, "folderId", "folderid", "id")),
    name: text(field(item, "folderName", "foldername", "name", "displayName")) || "Folder",
    total: Number(field(item, "totalCount", "messageCount", "total") ?? 0) || 0,
    unread: Number(field(item, "unreadCount", "unread") ?? 0) || 0,
  })).filter((folder) => /^\d+$/.test(folder.id));
}

function normalizeMessages(payload: unknown): ZohoMessage[] {
  return records(payload, ["messages", "emailList", "emails", "messageList"]).map((item) => {
    const sender = address(field(item, "fromAddress", "sender", "from", "fromaddress"));
    const readValue = field(item, "isRead", "isread", "read");
    const isUnread = field(item, "isUnread", "unread");
    const unread = isUnread === true || isUnread === "true" || readValue === false || readValue === "false" || readValue === 0;
    const rawDate = field(item, "receivedTime", "sentDateInGMT", "receivedDate", "date", "sentTime");
    const dateNumber = Number(rawDate);
    const date = Number.isFinite(dateNumber) && dateNumber > 0
      ? new Date(dateNumber < 10_000_000_000 ? dateNumber * 1000 : dateNumber).toISOString()
      : text(rawDate);
    const subject = text(field(item, "subject", "Subject")) || "(no subject)";
    const preview = text(field(item, "summary", "snippet", "preview", "content", "messageContent"));
    const rawFlag = text(field(item, "flagid", "flag", "flagType")).toLowerCase();
    return {
      id: text(field(item, "messageId", "messageid", "id")),
      threadId: text(field(item, "threadId", "threadid")) || undefined,
      subject,
      sender: sender.name || sender.email || "Unknown sender",
      senderAddress: sender.email,
      recipients: text(field(item, "toAddress", "toaddress", "to")),
      preview,
      date,
      unread,
      flagged: rawFlag !== "" && rawFlag !== "flag_not_set",
      raw: item,
    };
  }).filter((message) => /^\d+$/.test(message.id));
}

function messageContent(payload: unknown): string {
  const item = record(payload);
  const data = record(item.data);
  return text(field(item, "content", "messageContent", "htmlContent", "body") ?? field(data, "content", "messageContent", "htmlContent", "body"));
}

function safeMessageDocument(content: string): string {
  const isHtml = /<\s*(html|body|div|p|table|a|img|br)\b/i.test(content);
  const body = isHtml ? content : `<pre>${content.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; font-src data:"><meta name="referrer" content="no-referrer"><style>body{font:14px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#202421;overflow-wrap:anywhere;margin:16px}img{max-width:100%;height:auto}pre{white-space:pre-wrap;font:inherit}</style></head><body>${body}</body></html>`;
}

function displayDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const now = new Date();
  return date.toDateString() === now.toDateString()
    ? new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date)
    : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

function escapedHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/\n/g, "<br>");
}

function SignInGate() {
  const returnTo = encodeURIComponent(window.location.href);
  return (
    <main className="mail-gate">
      <div className="mail-gate-mark"><Mail size={24} /></div>
      <p className="mail-eyebrow">AFEON / PRIVATE SYSTEM</p>
      <h1>Administrator sign-in required</h1>
      <p>Sign in to your AFEON admin account, then authorize your Zoho mailbox separately.</p>
      <Button onClick={() => window.location.assign(`https://authn.afeonbooks.com/account?return_to=${returnTo}`)}>
        <LockKeyhole /> Continue to sign in
      </Button>
    </main>
  );
}

export default function Mailbox() {
  const { user, loading: authLoading, signOut } = useAuth();
  const [session, setSession] = useState<MailSession | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [folders, setFolders] = useState<ZohoFolder[]>([]);
  const [folderId, setFolderId] = useState("");
  const [messages, setMessages] = useState<ZohoMessage[]>([]);
  const [selected, setSelected] = useState<ZohoMessage | null>(null);
  const [content, setContent] = useState("");
  const [searchText, setSearchText] = useState("");
  const [query, setQuery] = useState("");
  const [pageStart, setPageStart] = useState(1);
  const [compose, setCompose] = useState<ComposeState | null>(null);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const activeFolder = useMemo(() => folders.find((folder) => folder.id === folderId), [folders, folderId]);

  useEffect(() => {
    document.title = "AFEON Mail";
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      window.location.replace(`https://authn.afeonbooks.com/account?return_to=${encodeURIComponent(window.location.href)}`);
      return;
    }
    if (user.role !== "admin") return;
    setCheckingSession(true);
    const params = new URLSearchParams(window.location.search);
    if (params.has("mail_connected") || params.has("mail_error")) {
      setNotice(params.has("mail_connected") ? "Zoho mailbox unlocked for this session." : "Zoho sign-in did not complete. Please try again.");
      window.history.replaceState({}, "", window.location.pathname);
    }
    void api<MailSession>("/api/mail/session").then(setSession).catch((err) => {
      setError(err instanceof Error ? err.message : "Unable to verify mailbox session");
      setSession({ unlocked: false });
    }).finally(() => setCheckingSession(false));
  }, [authLoading, user]);

  useEffect(() => {
    if (!session?.unlocked || user?.role !== "admin") return;
    void api<unknown>("/api/mail/folders").then((payload) => {
      const nextFolders = normalizeFolders(payload);
      setFolders(nextFolders);
      setFolderId((current) => current && nextFolders.some((folder) => folder.id === current)
        ? current
        : nextFolders.find((folder) => /inbox/i.test(folder.name))?.id ?? nextFolders[0]?.id ?? "");
    }).catch((err) => setError(err instanceof Error ? err.message : "Unable to load folders"));
  }, [session?.unlocked, user?.role]);

  useEffect(() => {
    if (!session?.unlocked || !folderId || user?.role !== "admin") return;
    setLoading(true);
    setError("");
    const endpoint = query
      ? `/api/mail/search?q=${encodeURIComponent(query)}&start=${pageStart}&limit=${MESSAGE_PAGE_SIZE}`
      : `/api/mail/messages?folderId=${encodeURIComponent(folderId)}&start=${pageStart}&limit=${MESSAGE_PAGE_SIZE}`;
    void api<unknown>(endpoint).then((payload) => {
      const nextMessages = normalizeMessages(payload);
      setMessages(nextMessages);
      setSelected((current) => current ? nextMessages.find((message) => message.id === current.id) ?? null : null);
    }).catch((err) => setError(err instanceof Error ? err.message : "Unable to load messages")).finally(() => setLoading(false));
  }, [session?.unlocked, folderId, query, pageStart, refreshKey, user?.role]);

  useEffect(() => {
    if (!session?.unlocked || !selected || !folderId || user?.role !== "admin") {
      setContent("");
      return;
    }
    setContent("");
    void api<unknown>(`/api/mail/messages/${folderId}/${selected.id}`).then((payload) => {
      setContent(messageContent(payload));
      if (selected.unread) {
        void api(`/api/mail/messages/${folderId}/${selected.id}/actions`, { method: "POST", body: JSON.stringify({ action: "read" }) })
          .then(() => setRefreshKey((key) => key + 1)).catch(() => undefined);
      }
    }).catch((err) => setError(err instanceof Error ? err.message : "Unable to open message"));
  }, [session?.unlocked, selected?.id, folderId, user?.role]);

  const startZohoSignIn = () => window.location.assign("/api/mail/auth/start");

  const lockMailbox = async () => {
    setWorking(true);
    try {
      await api("/api/mail/lock", { method: "POST" });
      setSession({ unlocked: false });
      setFolders([]);
      setMessages([]);
      setSelected(null);
      setContent("");
      setNotice("Mailbox locked.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to lock mailbox");
    } finally {
      setWorking(false);
    }
  };

  const runAction = async (action: Record<string, string>) => {
    if (!selected || !folderId) return;
    setWorking(true);
    setError("");
    try {
      await api(`/api/mail/messages/${folderId}/${selected.id}/actions`, { method: "POST", body: JSON.stringify(action) });
      setSelected(null);
      setContent("");
      setRefreshKey((key) => key + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mailbox action failed");
    } finally {
      setWorking(false);
    }
  };

  const openCompose = (mode: "new" | "reply") => {
    if (mode === "reply" && selected) {
      const subject = selected.subject.toLowerCase().startsWith("re:") ? selected.subject : `Re: ${selected.subject}`;
      setCompose({ mode, to: selected.senderAddress, subject, body: "" });
      return;
    }
    setCompose({ mode: "new", to: "", subject: "", body: "" });
  };

  const submitCompose = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!compose || !selected && compose.mode === "reply") return;
    const formData = new FormData(event.currentTarget);
    const to = String(formData.get("to") ?? "").split(/[;,\s]+/).filter(Boolean);
    const cc = String(formData.get("cc") ?? "").split(/[;,\s]+/).filter(Boolean);
    const subject = String(formData.get("subject") ?? "").trim();
    const body = String(formData.get("body") ?? "");
    if (!to.length || !subject || !body.trim()) {
      setError("Add a recipient, subject, and message.");
      return;
    }
    setWorking(true);
    setError("");
    try {
      const payload = { to, ...(cc.length ? { cc } : {}), subject, html: `<div style="font:14px/1.6 Arial,sans-serif">${escapedHtml(body)}</div>` };
      if (compose.mode === "reply" && selected) {
        await api(`/api/mail/messages/${folderId}/${selected.id}/reply`, { method: "POST", body: JSON.stringify(payload) });
      } else {
        await api("/api/mail/messages", { method: "POST", body: JSON.stringify(payload) });
      }
      setCompose(null);
      setNotice("Message sent.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send message");
    } finally {
      setWorking(false);
    }
  };

  if (authLoading || user?.role === "admin" && checkingSession) {
    return <main className="mail-gate"><LoaderCircle className="animate-spin" /><p>Securing mailbox session...</p></main>;
  }
  if (!user) return <SignInGate />;
  if (user.role !== "admin") {
    return (
      <main className="mail-gate">
        <div className="mail-gate-mark"><LockKeyhole size={24} /></div>
        <p className="mail-eyebrow">RESTRICTED ACCESS</p>
        <h1>Administrator access only</h1>
        <p>This mailbox is available only to AFEON administrators.</p>
        <Button onClick={async () => { await signOut(); window.location.assign("https://authn.afeonbooks.com/account"); }}><LogOut /> Sign out</Button>
      </main>
    );
  }

  if (!session?.unlocked) {
    return (
      <main className="mail-gate">
        <div className="mail-gate-mark"><LockKeyhole size={24} /></div>
        <p className="mail-eyebrow">AFEON / MAIL SYSTEM</p>
        <h1>Unlock your mailbox</h1>
        <p>Signed in as <strong>{user.email}</strong>. Sign in to Zoho separately to open mail. Access locks automatically after 30 minutes or when you lock it.</p>
        {error && <p className="mail-error">{error}</p>}
        {notice && <p className="mail-notice">{notice}</p>}
        <Button onClick={startZohoSignIn}><LockKeyhole /> Sign in to Zoho Mail</Button>
        <button className="mail-text-button" onClick={async () => { await signOut(); window.location.assign("https://authn.afeonbooks.com/account"); }}>Sign out of AFEON</button>
      </main>
    );
  }

  return (
    <main className="mail-app">
      <header className="mail-topbar">
        <a className="mail-brand" href="/"><span className="mail-brand-icon"><Mail size={19} /></span><span>AFEON <b>MAIL</b></span></a>
        <form className="mail-search" onSubmit={(event) => { event.preventDefault(); setQuery(searchText.trim()); setPageStart(1); setSelected(null); }}>
          <Search size={16} aria-hidden="true" />
          <input aria-label="Search mail" placeholder="Search all mail" value={searchText} onChange={(event) => setSearchText(event.target.value)} />
          {query && <button type="button" title="Clear search" onClick={() => { setSearchText(""); setQuery(""); setPageStart(1); }}><span className="sr-only">Clear search</span>×</button>}
        </form>
        <div className="mail-account">
          <span className="mail-account-address">{session.emailAddress}</span>
          <button title="Lock Zoho mailbox" aria-label="Lock Zoho mailbox" onClick={() => void lockMailbox()} disabled={working}><LockKeyhole size={17} /></button>
          <button title="Sign out of AFEON" aria-label="Sign out of AFEON" onClick={async () => { await signOut(); window.location.assign("https://authn.afeonbooks.com/account"); }}><LogOut size={17} /></button>
        </div>
      </header>

      <div className="mail-workspace">
        <aside className="mail-sidebar">
          <Button className="mail-compose-button" onClick={() => openCompose("new")}><Pencil size={16} /> Compose</Button>
          <nav aria-label="Mail folders" className="mail-folder-list">
            {folders.map((folder) => {
              const isSelected = folder.id === folderId;
              const FolderIcon = /inbox/i.test(folder.name) ? Inbox : /sent/i.test(folder.name) ? Send : /draft/i.test(folder.name) ? FileText : /trash|deleted/i.test(folder.name) ? Trash2 : /archive/i.test(folder.name) ? Archive : Mail;
              return <button key={folder.id} className={`mail-folder ${isSelected ? "is-selected" : ""}`} onClick={() => { setFolderId(folder.id); setQuery(""); setSearchText(""); setPageStart(1); setSelected(null); }}><FolderIcon size={17} /><span>{folder.name}</span>{folder.unread ? <b>{folder.unread}</b> : null}</button>;
            })}
          </nav>
          <div className="mail-sidebar-foot"><span className="mail-secure-dot" /> Session locked in {session.unlockedUntil ? new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(session.unlockedUntil)) : "30 min"}</div>
        </aside>

        <section className={`mail-list-pane ${selected ? "has-selection" : ""}`} aria-label="Messages">
          <div className="mail-list-heading">
            <div><p className="mail-eyebrow">{query ? "SEARCH RESULTS" : "MAILBOX"}</p><h1>{query ? `Results for “${query}”` : activeFolder?.name ?? "Messages"}</h1></div>
            <button title="Refresh messages" aria-label="Refresh messages" onClick={() => setRefreshKey((key) => key + 1)} disabled={loading}><RefreshCw size={17} className={loading ? "animate-spin" : ""} /></button>
          </div>
          {error && <div className="mail-inline-error"><CircleAlert size={16} /> {error}</div>}
          {notice && <div className="mail-inline-notice">{notice}<button onClick={() => setNotice("")} aria-label="Dismiss notice">×</button></div>}
          {loading && messages.length === 0 ? <div className="mail-empty"><LoaderCircle className="animate-spin" /> Loading messages</div> : null}
          {!loading && messages.length === 0 ? <div className="mail-empty"><MailOpen size={28} /><p>{query ? "No matching messages" : "This folder is empty"}</p></div> : null}
          <div className="mail-message-list">
            {messages.map((message) => (
              <button key={message.id} className={`mail-message-row ${selected?.id === message.id ? "is-active" : ""} ${message.unread ? "is-unread" : ""}`} onClick={() => setSelected(message)}>
                <span className="mail-message-sender">{message.sender}</span>
                <span className="mail-message-date">{displayDate(message.date)}</span>
                <span className="mail-message-subject">{message.subject}</span>
                <span className="mail-message-preview">{message.preview || message.recipients || "Open message"}</span>
                {message.flagged && <Flag className="mail-message-flag" size={14} fill="currentColor" />}
              </button>
            ))}
          </div>
          {messages.length > 0 && <div className="mail-pagination"><button disabled={pageStart <= 1} onClick={() => setPageStart((value) => Math.max(1, value - MESSAGE_PAGE_SIZE))} aria-label="Newer messages"><ChevronLeft size={17} /></button><span>{pageStart}–{pageStart + messages.length - 1}</span><button disabled={messages.length < MESSAGE_PAGE_SIZE} onClick={() => setPageStart((value) => value + MESSAGE_PAGE_SIZE)} aria-label="Older messages"><ChevronRight size={17} /></button></div>}
        </section>

        <section className={`mail-reading-pane ${selected ? "has-selection" : ""}`} aria-label="Message preview">
          {selected ? <>
            <div className="mail-reading-toolbar">
              <button className="mail-mobile-back" onClick={() => setSelected(null)} title="Back to messages"><ArrowLeft size={17} /></button>
              <button title="Reply" aria-label="Reply" onClick={() => openCompose("reply")}><ArrowLeftRight size={17} /></button>
              <button title={selected.unread ? "Mark as read" : "Mark as unread"} aria-label={selected.unread ? "Mark as read" : "Mark as unread"} onClick={() => void runAction({ action: selected.unread ? "read" : "unread" })}><MailOpen size={17} /></button>
              <button title="Archive" aria-label="Archive" onClick={() => void runAction({ action: "archive" })}><Archive size={17} /></button>
              <button title={selected.flagged ? "Clear flag" : "Flag important"} aria-label={selected.flagged ? "Clear flag" : "Flag important"} onClick={() => void runAction({ action: "flag", flag: selected.flagged ? "flag_not_set" : "important" })}><Star size={17} fill={selected.flagged ? "currentColor" : "none"} /></button>
              <select aria-label="Move message to folder" value="" onChange={(event) => { if (event.target.value) void runAction({ action: "move", destinationFolderId: event.target.value }); }}><option value="">Move to…</option>{folders.filter((folder) => folder.id !== folderId).map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select>
              <button className="mail-delete-action" title="Move to Trash" aria-label="Move to Trash" onClick={() => void runAction({ action: "delete" })}><Trash2 size={17} /></button>
            </div>
            <article className="mail-reading-content">
              <div className="mail-subject-line"><h2>{selected.subject}</h2><span>{displayDate(selected.date)}</span></div>
              <div className="mail-sender-details"><div className="mail-sender-avatar">{(selected.sender[0] || "?").toUpperCase()}</div><div><strong>{selected.sender}</strong><p>{selected.senderAddress}</p></div></div>
              <div className="mail-recipient-line">To {selected.recipients || session.emailAddress}</div>
              {content ? <iframe className="mail-message-frame" title={`Message: ${selected.subject}`} sandbox="" referrerPolicy="no-referrer" srcDoc={safeMessageDocument(content)} /> : <div className="mail-body-loading"><LoaderCircle className="animate-spin" /> Loading message content</div>}
            </article>
          </> : <div className="mail-reading-empty"><Mail size={28} /><p>Select a message to read</p></div>}
        </section>
      </div>

      {compose && <div className="mail-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !working) setCompose(null); }}>
        <form className="mail-compose-modal" onSubmit={submitCompose}>
          <div className="mail-compose-head"><h2>{compose.mode === "reply" ? "Reply" : "New message"}</h2><button type="button" title="Close" aria-label="Close compose" onClick={() => setCompose(null)}>×</button></div>
          <label>To<input name="to" type="text" defaultValue={compose.to} placeholder="name@example.com" autoComplete="off" required /></label>
          <label>Cc<input name="cc" type="text" placeholder="Optional recipients" autoComplete="off" /></label>
          <label>Subject<input name="subject" type="text" defaultValue={compose.subject} maxLength={998} required /></label>
          <label className="mail-compose-body-label">Message<textarea name="body" placeholder="Write your message" required /></label>
          {error && <p className="mail-error">{error}</p>}
          <div className="mail-compose-actions"><Button type="submit" disabled={working}><Send size={16} /> {working ? "Sending…" : "Send"}</Button><button type="button" onClick={() => setCompose(null)} disabled={working}>Discard</button></div>
        </form>
      </div>}
    </main>
  );
}