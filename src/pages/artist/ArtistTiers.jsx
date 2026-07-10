import { useState, useEffect } from "react";
import { Plus, Trash2, Edit2, Users, DollarSign, Star, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { toast } from "sonner";

const COLORS = [
  { label: "Pink", value: "primary" },
  { label: "Blue", value: "accent" },
  { label: "Gold", value: "yellow" },
  { label: "Green", value: "green" },
];

const colorClasses = {
  primary: "bg-primary/10 border-primary/30 text-primary",
  accent:  "bg-accent/10 border-accent/30 text-accent",
  yellow:  "bg-yellow-400/10 border-yellow-400/30 text-yellow-400",
  green:   "bg-green-400/10 border-green-400/30 text-green-400",
};

const BLANK = { name: "", description: "", price: "", color: "primary", perks: [""] };

export default function ArtistTiers() {
  const [artist, setArtist] = useState(null);
  const [tiers, setTiers] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // tier id or "new"
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("tiers"); // "tiers" | "subscribers"

  useEffect(() => {
    base44.auth.me().then(async (user) => {
      const artists = await base44.entities.Artist.filter({ user_email: user.email }, null, 1);
      if (!artists[0]) { setLoading(false); return; }
      const a = artists[0];
      setArtist(a);
      const [t, s] = await Promise.all([
        base44.entities.FanTier.filter({ artist_id: a.id }, "sort_order", 20),
        base44.entities.FanSubscription.filter({ artist_id: a.id }, "-created_date", 200),
      ]);
      setTiers(t);
      setSubscriptions(s);
      setLoading(false);
    });
  }, []);

  const startEdit = (tier) => {
    setForm({ name: tier.name, description: tier.description || "", price: String(tier.price), color: tier.color || "primary", perks: tier.perks?.length ? tier.perks : [""] });
    setEditing(tier.id);
  };

  const startNew = () => {
    setForm(BLANK);
    setEditing("new");
  };

  const handleSave = async () => {
    if (!form.name || !form.price) { toast.error("Name and price are required"); return; }
    setSaving(true);
    const data = {
      artist_id: artist.id,
      artist_name: artist.display_name,
      artist_email: artist.user_email,
      name: form.name,
      description: form.description,
      price: parseFloat(form.price),
      color: form.color,
      perks: form.perks.filter(p => p.trim()),
      is_active: true,
      sort_order: tiers.length,
    };
    if (editing === "new") {
      const t = await base44.entities.FanTier.create(data);
      setTiers(prev => [...prev, t]);
      toast.success("Tier created!");
    } else {
      await base44.entities.FanTier.update(editing, data);
      setTiers(prev => prev.map(t => t.id === editing ? { ...t, ...data } : t));
      toast.success("Tier updated!");
    }
    setEditing(null);
    setSaving(false);
  };

  const handleDelete = async (id) => {
    await base44.entities.FanTier.delete(id);
    setTiers(prev => prev.filter(t => t.id !== id));
    toast.success("Tier deleted");
  };

  const addPerk = () => setForm(f => ({ ...f, perks: [...f.perks, ""] }));
  const updatePerk = (i, val) => setForm(f => ({ ...f, perks: f.perks.map((p, idx) => idx === i ? val : p) }));
  const removePerk = (i) => setForm(f => ({ ...f, perks: f.perks.filter((_, idx) => idx !== i) }));

  const activeSubscribers = subscriptions.filter(s => s.status === "active");
  const monthlyRevenue = activeSubscribers.reduce((sum, s) => sum + (s.amount || 0), 0);

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;
  if (!artist) return <div className="text-center py-20 text-muted-foreground">No artist profile found.</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display font-black text-3xl tracking-tight">FAN TIERS</h1>
          <p className="text-sm text-muted-foreground font-mono mt-0.5">Monthly subscriptions for exclusive perks</p>
        </div>
        <div className="flex gap-2 text-sm font-mono">
          <span className="text-green-400 font-bold">${monthlyRevenue.toFixed(2)}/mo</span>
          <span className="text-muted-foreground">· {activeSubscribers.length} active</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex rounded-lg border border-border/50 overflow-hidden w-fit">
        {["tiers", "subscribers"].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-mono font-bold capitalize transition-all ${activeTab === tab ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"}`}>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "tiers" && (
        <div className="space-y-4">
          {/* Tier list */}
          {tiers.map(tier => (
            <div key={tier.id} className={`p-4 rounded-xl border ${colorClasses[tier.color || "primary"]} relative`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Star className="w-4 h-4" />
                    <p className="font-display font-bold text-lg">{tier.name}</p>
                    <span className="font-mono font-black text-base">${tier.price}/mo</span>
                  </div>
                  {tier.description && <p className="text-sm opacity-80 mt-1">{tier.description}</p>}
                  {tier.perks?.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {tier.perks.map((p, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm">
                          <Check className="w-3.5 h-3.5 shrink-0" /> {p}
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="text-xs opacity-60 font-mono mt-2">
                    {subscriptions.filter(s => s.tier_id === tier.id && s.status === "active").length} subscribers
                  </p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={() => startEdit(tier)} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(tier.id)} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          ))}

          {/* Edit / New form */}
          {editing && (
            <div className="p-5 rounded-xl bg-card border border-border/50 space-y-4">
              <h3 className="font-display font-bold">{editing === "new" ? "New Tier" : "Edit Tier"}</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label className="text-xs font-mono text-muted-foreground">Tier Name *</Label>
                  <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Supporter, VIP, Backstage" className="mt-1 bg-secondary border-border/50" />
                </div>
                <div>
                  <Label className="text-xs font-mono text-muted-foreground">Monthly Price ($) *</Label>
                  <Input type="number" min="1" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })}
                    placeholder="e.g. 5" className="mt-1 bg-secondary border-border/50" />
                </div>
                <div>
                  <Label className="text-xs font-mono text-muted-foreground">Color</Label>
                  <div className="flex gap-2 mt-1">
                    {COLORS.map(c => (
                      <button key={c.value} onClick={() => setForm({ ...form, color: c.value })}
                        className={`w-7 h-7 rounded-full border-2 transition-all ${colorClasses[c.value]} ${form.color === c.value ? "scale-110 border-white" : "border-transparent"}`} />
                    ))}
                  </div>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs font-mono text-muted-foreground">Description</Label>
                  <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                    placeholder="What do fans get?" className="mt-1 bg-secondary border-border/50" />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs font-mono text-muted-foreground">Perks</Label>
                  <div className="space-y-2 mt-1">
                    {form.perks.map((p, i) => (
                      <div key={i} className="flex gap-2">
                        <Input value={p} onChange={e => updatePerk(i, e.target.value)}
                          placeholder={`Perk ${i + 1} (e.g. Early music access)`} className="bg-secondary border-border/50" />
                        {form.perks.length > 1 && (
                          <button onClick={() => removePerk(i)} className="p-2 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-destructive">
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    <button onClick={addPerk} className="text-xs font-mono text-primary hover:underline">+ Add perk</button>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={saving} className="glow-lime font-display font-bold">{saving ? "Saving..." : "Save Tier"}</Button>
                <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              </div>
            </div>
          )}

          {!editing && (
            <Button onClick={startNew} variant="outline" className="gap-2 border-dashed border-border/50 w-full font-display font-bold">
              <Plus className="w-4 h-4" /> Add New Tier
            </Button>
          )}
        </div>
      )}

      {activeTab === "subscribers" && (
        <div className="space-y-3">
          {subscriptions.length === 0 ? (
            <div className="text-center py-16 bg-card rounded-xl border border-border/50">
              <Users className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">No subscribers yet</p>
            </div>
          ) : (
            <div className="rounded-xl bg-card border border-border/50 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left p-3 font-mono text-[10px] text-muted-foreground uppercase">Fan</th>
                    <th className="text-left p-3 font-mono text-[10px] text-muted-foreground uppercase">Tier</th>
                    <th className="text-left p-3 font-mono text-[10px] text-muted-foreground uppercase">Amount</th>
                    <th className="text-left p-3 font-mono text-[10px] text-muted-foreground uppercase">Status</th>
                    <th className="text-left p-3 font-mono text-[10px] text-muted-foreground uppercase">Since</th>
                  </tr>
                </thead>
                <tbody>
                  {subscriptions.map(sub => (
                    <tr key={sub.id} className="border-b border-border/30 last:border-0">
                      <td className="p-3">
                        <p className="font-medium">{sub.fan_name || "Fan"}</p>
                        <p className="text-xs text-muted-foreground">{sub.fan_email}</p>
                      </td>
                      <td className="p-3 font-mono text-xs font-bold">{sub.tier_name}</td>
                      <td className="p-3 font-mono font-bold text-green-400">${sub.amount}/mo</td>
                      <td className="p-3">
                        <span className={`font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                          sub.status === "active" ? "text-green-400 bg-green-400/10" :
                          sub.status === "cancelled" ? "text-destructive bg-destructive/10" :
                          "text-yellow-400 bg-yellow-400/10"
                        }`}>{sub.status}</span>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground font-mono">
                        {sub.started_at ? format(new Date(sub.started_at), "MMM dd, yyyy") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}