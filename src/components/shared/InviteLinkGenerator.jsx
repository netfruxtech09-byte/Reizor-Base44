import { useState, useEffect } from "react";
import { Link2, Copy, Check, Plus, Trash2, Loader2, RefreshCw } from "lucide-react";
import { getAppUrl } from "@/lib/appUrl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { format } from "date-fns";

function generateCode() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

const ROLE_OPTIONS = [
  { value: "user", label: "Fan / User" },
  { value: "organizer", label: "Organizer" },
  { value: "artist", label: "Artist" },
  { value: "manager", label: "Manager" },
  { value: "vendor", label: "Vendor" },
];

export default function InviteLinkGenerator({ currentUser, allowedRoles, showForm: initialShowForm = false }) {
   const [links, setLinks] = useState([]);
   const [loading, setLoading] = useState(true);
   const [creating, setCreating] = useState(false);
   const [copiedId, setCopiedId] = useState(null);
   const [showForm, setShowForm] = useState(initialShowForm);
   const [form, setForm] = useState({ target_role: "user", label: "", max_uses: "0", expires_at: "" });

  const roles = allowedRoles
    ? ROLE_OPTIONS.filter(r => allowedRoles.includes(r.value))
    : ROLE_OPTIONS;

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const all = await base44.entities.InviteLink.filter(
      { created_by_email: currentUser.email }, "-created_date", 50
    ).catch(() => []);
    setLinks(all);
    setLoading(false);
  }

  async function handleCreate() {
    setCreating(true);
    const code = generateCode();
    const payload = {
      code,
      created_by_email: currentUser.email,
      created_by_name: currentUser.full_name || currentUser.email,
      created_by_role: currentUser.role || "user",
      target_role: form.target_role,
      label: form.label.trim() || null,
      max_uses: parseInt(form.max_uses) || 0,
      status: "active",
    };
    if (form.expires_at) payload.expires_at = new Date(form.expires_at).toISOString();
    const created = await base44.entities.InviteLink.create(payload);
    setLinks(prev => [created, ...prev]);
    setShowForm(false);
    setForm({ target_role: "user", label: "", max_uses: "0", expires_at: "" });
    toast.success("Invite link created!");
    setCreating(false);
  }

  async function handleDelete(link) {
    if (!confirm("Delete this invite link? It will stop working immediately.")) return;
    await base44.entities.InviteLink.delete(link.id);
    setLinks(prev => prev.filter(l => l.id !== link.id));
    toast.success("Link deleted");
  }

  async function handleDisable(link) {
    const newStatus = link.status === "active" ? "disabled" : "active";
    await base44.entities.InviteLink.update(link.id, { status: newStatus });
    setLinks(prev => prev.map(l => l.id === link.id ? { ...l, status: newStatus } : l));
    toast.success(newStatus === "active" ? "Link re-enabled" : "Link disabled");
  }

  function copyLink(link) {
    const url = getAppUrl(`/invite/${link.code}`);
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(link.id);
      toast.success("Link copied!");
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  function getLinkUrl(link) {
    return getAppUrl(`/invite/${link.code}`);
  }

  function isExpired(link) {
    return link.expires_at && new Date(link.expires_at) < new Date();
  }

  function isExhausted(link) {
    return link.max_uses > 0 && link.times_used >= link.max_uses;
  }

  function getStatusColor(link) {
    if (link.status === "disabled") return "text-muted-foreground bg-muted";
    if (isExpired(link) || isExhausted(link)) return "text-destructive bg-destructive/10";
    return "text-green-400 bg-green-400/10";
  }

  function getStatusLabel(link) {
    if (link.status === "disabled") return "Disabled";
    if (isExpired(link)) return "Expired";
    if (isExhausted(link)) return "Used Up";
    return "Active";
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div>
          <h2 className="font-display font-bold text-lg flex items-center gap-2">
            <Link2 className="w-4 h-4 text-accent" /> Invite Links
          </h2>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">
            Share without needing an email — works via WhatsApp, SMS, etc.
          </p>
        </div>
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">
              {links.length} active link{links.length !== 1 ? "s" : ""}
            </span>
            <Button size="sm" variant="ghost" onClick={load} className="gap-1.5 h-7 px-2">
              <RefreshCw className="w-3 h-3" />
            </Button>
          </div>
          <Button size="sm" onClick={() => setShowForm(v => !v)} className="gap-1.5 font-mono font-bold">
            <Plus className="w-3.5 h-3.5" /> {showForm ? "Cancel" : "New Link"}
          </Button>
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="p-4 rounded-xl bg-secondary border border-border/50 space-y-3">
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Create Invite Link</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-mono text-muted-foreground">Label (optional)</label>
              <Input
                value={form.label}
                onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                placeholder="e.g. WhatsApp Group July"
                className="bg-card border-border/50 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-mono text-muted-foreground">Role for invited user</label>
              <Select value={form.target_role} onValueChange={v => setForm(f => ({ ...f, target_role: v }))}>
                <SelectTrigger className="bg-card border-border/50 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roles.map(r => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-mono text-muted-foreground">Max uses (0 = unlimited)</label>
              <Input
                type="number"
                min={0}
                value={form.max_uses}
                onChange={e => setForm(f => ({ ...f, max_uses: e.target.value }))}
                className="bg-card border-border/50 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-mono text-muted-foreground">Expires at (optional)</label>
              <Input
                type="datetime-local"
                value={form.expires_at}
                onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))}
                className="bg-card border-border/50 text-sm"
              />
            </div>
          </div>
          <Button onClick={handleCreate} disabled={creating} className="gap-1.5 font-display font-bold">
            {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
            {creating ? "Creating..." : "Generate Invite Link"}
          </Button>
        </div>
      )}

      {/* Links list */}
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : links.length === 0 ? (
        <p className="text-xs text-muted-foreground italic text-center py-6">No invite links yet</p>
      ) : (
        <div className="space-y-2">
          {links.map(link => (
            <div key={link.id} className={`p-3 rounded-xl border ${link.status !== "active" || isExpired(link) || isExhausted(link) ? "opacity-60 border-border/30 bg-muted/30" : "bg-card border-border/50"}`}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {link.label && <span className="font-bold text-sm">{link.label}</span>}
                    <span className={`font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded ${getStatusColor(link)}`}>
                      {getStatusLabel(link)}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded uppercase">
                      {link.target_role}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {link.times_used || 0} use{link.times_used !== 1 ? "s" : ""}{link.max_uses > 0 ? ` / ${link.max_uses}` : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-mono text-[11px] text-muted-foreground truncate max-w-[220px] sm:max-w-[340px]">
                      {getLinkUrl(link)}
                    </span>
                  </div>
                  {link.expires_at && (
                    <p className="text-[10px] font-mono text-muted-foreground">
                      Expires: {format(new Date(link.expires_at), "MMM dd, yyyy · h:mm a")}
                    </p>
                  )}
                  <p className="text-[10px] font-mono text-muted-foreground/60">
                    Created {link.created_date ? format(new Date(link.created_date), "MMM dd, yyyy") : ""}
                    {link.first_used_at && (
                      <span className="ml-2 text-green-400/70">· First used {format(new Date(link.first_used_at), "MMM dd, yyyy")}</span>
                    )}
                    {link.last_used_at && link.times_used > 1 && (
                      <span className="ml-2 text-muted-foreground/50">· Last used {format(new Date(link.last_used_at), "MMM dd, yyyy")}</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => copyLink(link)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border/50 text-xs font-mono font-bold text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                  >
                    {copiedId === link.id ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedId === link.id ? "Copied!" : "Copy"}
                  </button>
                  <button
                    onClick={() => handleDisable(link)}
                    className="px-2.5 py-1.5 rounded-lg border border-border/50 text-xs font-mono font-bold text-muted-foreground hover:text-foreground hover:border-yellow-400/40 transition-colors"
                  >
                    {link.status === "active" ? "Disable" : "Enable"}
                  </button>
                  <button
                    onClick={() => handleDelete(link)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}