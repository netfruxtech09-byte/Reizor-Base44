/**
 * SubWhiteLabelManager — Allows a WL/Sub-WL admin to create and manage
 * direct Sub-White-Labels under their own account WITHOUT requiring
 * Reizor admin approval. The parent WL sets the fee directly.
 *
 * A WL admin can create Sub-WLs by sending an invite link.
 * The created Sub-WL record has parent_wl_id = agent.id.
 *
 * Reizor Main Admin still sees all Sub-WLs in the admin panel.
 */
import { useState, useEffect } from "react";
import { Plus, RotateCcw, Send, Copy, X, Check, Users, ExternalLink, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { format } from "date-fns";

export default function SubWhiteLabelManager({ agent, currentUser }) {
  const [subWLs, setSubWLs] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generatedLink, setGeneratedLink] = useState("");
  const [form, setForm] = useState({
    sub_wl_name: "", sub_wl_email: "", sub_wl_brand: "",
  });

  const loadSubWLs = async () => {
    setLoading(true);
    const records = await base44.entities.WhiteLabel.filter({ parent_wl_id: agent.id }, "-created_date", 50).catch(() => []);
    setSubWLs(records);
    setLoading(false);
  };

  useEffect(() => { loadSubWLs(); }, [agent.id]);

  const handleCreate = async () => {
    if (!form.sub_wl_name || !form.sub_wl_email) return toast.error("Contact name and email are required");
    const normalizedEmail = form.sub_wl_email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return toast.error("Please enter a valid email address");

    // Check for duplicate
    const dup = subWLs.find(w => w.email?.toLowerCase() === normalizedEmail);
    if (dup) return toast.error("A Sub-White-Label with this email already exists under your account");

    setSaving(true);
    setGeneratedLink("");

    try {
      // Create the Sub-WL record directly — no admin approval needed
      const created = await base44.entities.WhiteLabel.create({
        name: form.sub_wl_name.trim(),
        email: normalizedEmail,
        brand_name: form.sub_wl_brand.trim() || form.sub_wl_name.trim(),
        parent_wl_id: agent.id,
        parent_wl_name: agent.brand_name || agent.name,
        is_active: false,
        can_add_artists: true,
        can_add_organizers: true,
        permitted_features: [],
        revenue_rates: {},
        signup_status: "invited",
      });

      const inviteLink = `${window.location.origin}/agent-dashboard?setup=1&wl_id=${created.id}&email=${encodeURIComponent(normalizedEmail)}`;
      setGeneratedLink(inviteLink);

      // Send invite email via dedicated backend function (service role Gmail)
      const parentBrandName = agent.brand_name || agent.name || "Your Partner";
      let emailSent = false;
      try {
        await base44.functions.invoke('sendWLInvite', {
          to: normalizedEmail,
          name: form.sub_wl_name.trim(),
          link: inviteLink,
          senderName: parentBrandName,
          role: "sub_white_label",
          _source: "SubWhiteLabelManager/invite",
        });
        emailSent = true;
      } catch (emailErr) {
        console.error("[SubWL] Email send failed:", emailErr.message);
      }

      setSubWLs(prev => [created, ...prev]);
      setShowForm(false);
      setForm({ sub_wl_name: "", sub_wl_email: "", sub_wl_brand: "" });

      if (emailSent) {
        toast.success(`Sub-White-Label created and invite sent to ${normalizedEmail}`);
      } else {
        toast.success("Sub-White-Label created. Copy the invite link below to share manually.");
      }
    } catch (err) {
      toast.error("Could not create Sub-White-Label: " + (err.message || "Unknown error"));
    }

    setSaving(false);
  };

  const copyLink = (link) => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(link).then(() => toast.success("Link copied!")).catch(() => fallbackCopy(link));
    } else {
      fallbackCopy(link);
    }
  };

  const fallbackCopy = (text) => {
    const el = document.createElement("textarea");
    el.value = text;
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
    toast.success("Link copied!");
  };

  const getInviteLink = (wl) =>
    `${window.location.origin}/agent-dashboard?setup=1&wl_id=${wl.id}&email=${encodeURIComponent(wl.email)}`;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display font-bold text-lg">SUB-WHITE-LABELS</h2>
          <p className="text-xs text-muted-foreground font-mono leading-relaxed">
            Create and manage branded sub-partners under your account
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={loadSubWLs} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Refresh">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <Button onClick={() => { setShowForm(v => !v); setGeneratedLink(""); }} size="sm" className="gap-1.5 font-display font-bold glow-lime">
            <Plus className="w-3.5 h-3.5" /> Add Sub-WL
          </Button>
        </div>
      </div>

      {/* Generated invite link display */}
      {generatedLink && (
        <div className="p-3 rounded-xl bg-green-400/10 border border-green-400/20 space-y-2">
          <p className="text-xs font-mono text-green-400 font-bold">✅ Sub-WL created! Share this invite link:</p>
          <div className="flex gap-2">
            <input readOnly value={generatedLink}
              className="flex-1 bg-background border border-border/50 rounded px-2 py-1.5 text-xs font-mono text-muted-foreground" />
            <Button size="icon" variant="outline" className="h-8 w-8 shrink-0" onClick={() => copyLink(generatedLink)}>
              <Copy className="w-3.5 h-3.5" />
            </Button>
          </div>
          <button onClick={() => setGeneratedLink("")} className="text-xs font-mono text-muted-foreground hover:text-foreground">Dismiss</button>
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div className="p-4 rounded-xl bg-card border border-border/50 space-y-4">
          <p className="font-bold text-sm">Create New Sub-White-Label</p>
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-mono text-muted-foreground">Contact Name *</Label>
              <Input value={form.sub_wl_name} onChange={e => setForm(f => ({ ...f, sub_wl_name: e.target.value }))}
                placeholder="Jane Doe" className="mt-1 bg-secondary border-border/50 w-full" />
            </div>
            <div>
              <Label className="text-xs font-mono text-muted-foreground">Email *</Label>
              <Input value={form.sub_wl_email} onChange={e => setForm(f => ({ ...f, sub_wl_email: e.target.value }))}
                placeholder="jane@agency.com" className="mt-1 bg-secondary border-border/50 w-full" />
            </div>
            <div>
              <Label className="text-xs font-mono text-muted-foreground">Brand / Agency Name</Label>
              <Input value={form.sub_wl_brand} onChange={e => setForm(f => ({ ...f, sub_wl_brand: e.target.value }))}
                placeholder="Sub Agency LLC" className="mt-1 bg-secondary border-border/50 w-full" />
            </div>
          </div>
          <p className="text-[10px] font-mono text-muted-foreground bg-muted/50 rounded px-2 py-1.5">
            An invite link will be generated and emailed. You can set their platform fee below after creation.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={handleCreate} disabled={saving} className="glow-lime font-display font-bold w-full sm:w-auto gap-2">
              <Send className="w-3.5 h-3.5" /> {saving ? "Creating..." : "Create & Send Invite"}
            </Button>
            <Button variant="outline" onClick={() => setShowForm(false)} className="w-full sm:w-auto">Cancel</Button>
          </div>
        </div>
      )}

      {/* Sub-WL list */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : subWLs.length === 0 ? (
        <div className="py-10 text-center rounded-xl bg-card border border-dashed border-border/50">
          <Users className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">No sub-white-labels yet</p>
          <p className="text-xs text-muted-foreground font-mono mt-1">Click "Add Sub-WL" to invite your first partner</p>
        </div>
      ) : (
        <div className="space-y-3">
          {subWLs.map(wl => {
            const isPending = wl.signup_status === "invited" || !wl.brand_name;
            return (
              <div key={wl.id} className="rounded-xl bg-card border border-border/50 overflow-hidden">
                <div className="flex items-center gap-3 p-4">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm shrink-0">
                    {(wl.brand_name || wl.name || "?")[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{wl.brand_name || wl.name || "Unnamed"}</p>
                    <p className="text-xs font-mono text-muted-foreground truncate">{wl.email}</p>
                    {wl.created_date && (
                      <p className="text-[10px] font-mono text-muted-foreground/60 mt-0.5">
                        Invited {format(new Date(wl.created_date), "MMM d, yyyy")}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                      isPending ? "text-yellow-400 bg-yellow-400/10" : "text-green-400 bg-green-400/10"
                    }`}>
                      {isPending ? "Pending Setup" : "Active"}
                    </span>
                    {isPending && (
                      <button
                        onClick={() => copyLink(getInviteLink(wl))}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        title="Copy invite link"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {!isPending && (
                      <span
                        className="p-1.5 rounded-lg text-muted-foreground/40"
                        title="Sub-WL admin accesses their own dashboard by logging in"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}