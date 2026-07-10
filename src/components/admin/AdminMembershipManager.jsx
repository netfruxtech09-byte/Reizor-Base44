import { useState, useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { format } from "date-fns";

export default function AdminMembershipManager() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    fan_email: "",
    tier_id: "",
    tier_name: "",
    artist_id: "",
    artist_name: "",
    artist_email: "",
    amount: 0,
    is_free: true,
  });

  useEffect(() => {
    base44.asServiceRole.entities.FanSubscription.filter({ status: "active" }, "-started_at", 100).then((subs) => {
      setSubscriptions(subs);
      setLoading(false);
    });
  }, []);

  const handleUpgrade = async () => {
    if (!formData.fan_email || !formData.tier_id) {
      toast.error("Fill required fields");
      return;
    }

    const res = await base44.functions.invoke("adminUpgradeMembership", {
      fan_email: formData.fan_email,
      tier_id: formData.tier_id,
      tier_name: formData.tier_name,
      artist_id: formData.artist_id,
      artist_name: formData.artist_name,
      artist_email: formData.artist_email,
      amount: formData.amount,
      is_free: formData.is_free,
    });

    if (res.data.success) {
      setFormData({ fan_email: "", tier_id: "", tier_name: "", artist_id: "", artist_name: "", artist_email: "", amount: 0, is_free: true });
      setShowForm(false);
      toast.success("Membership updated");
      // Refresh list
      const updated = await base44.asServiceRole.entities.FanSubscription.filter({ status: "active" }, "-started_at", 100);
      setSubscriptions(updated);
    }
  };

  const handleDelete = async (subId) => {
    if (!confirm("Delete this membership?")) return;
    await base44.asServiceRole.entities.FanSubscription.delete(subId);
    setSubscriptions((prev) => prev.filter((s) => s.id !== subId));
    toast.success("Membership deleted");
  };

  if (loading) return <div className="flex items-center justify-center py-8"><div className="w-4 h-4 border-2 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-bold text-lg">Manage Memberships</h2>
        <Button onClick={() => setShowForm(!showForm)} size="sm" className="gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Upgrade User
        </Button>
      </div>

      {showForm && (
        <div className="p-6 rounded-xl bg-card border border-border/50 space-y-4">
          <input
            type="email"
            placeholder="Fan Email"
            value={formData.fan_email}
            onChange={(e) => setFormData({ ...formData, fan_email: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-secondary border border-border/50 text-sm"
          />
          <div className="grid grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Tier ID"
              value={formData.tier_id}
              onChange={(e) => setFormData({ ...formData, tier_id: e.target.value })}
              className="px-3 py-2 rounded-lg bg-secondary border border-border/50 text-sm"
            />
            <input
              type="text"
              placeholder="Tier Name"
              value={formData.tier_name}
              onChange={(e) => setFormData({ ...formData, tier_name: e.target.value })}
              className="px-3 py-2 rounded-lg bg-secondary border border-border/50 text-sm"
            />
            <input
              type="text"
              placeholder="Artist ID"
              value={formData.artist_id}
              onChange={(e) => setFormData({ ...formData, artist_id: e.target.value })}
              className="px-3 py-2 rounded-lg bg-secondary border border-border/50 text-sm"
            />
            <input
              type="text"
              placeholder="Artist Name"
              value={formData.artist_name}
              onChange={(e) => setFormData({ ...formData, artist_name: e.target.value })}
              className="px-3 py-2 rounded-lg bg-secondary border border-border/50 text-sm"
            />
            <input
              type="email"
              placeholder="Artist Email"
              value={formData.artist_email}
              onChange={(e) => setFormData({ ...formData, artist_email: e.target.value })}
              className="px-3 py-2 rounded-lg bg-secondary border border-border/50 text-sm col-span-2"
            />
          </div>
          {!formData.is_free && (
            <input
              type="number"
              placeholder="Amount ($)"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
              className="w-full px-3 py-2 rounded-lg bg-secondary border border-border/50 text-sm"
            />
          )}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.is_free}
              onChange={(e) => setFormData({ ...formData, is_free: e.target.checked })}
              className="rounded"
            />
            <span className="text-sm">Free Upgrade (No Charge)</span>
          </label>

          <div className="flex gap-2">
            <Button onClick={handleUpgrade} className="flex-1 font-display font-bold">
              Upgrade Membership
            </Button>
            <Button variant="outline" onClick={() => setShowForm(false)} className="flex-1">
              Cancel
            </Button>
          </div>
        </div>
      )}

      {subscriptions.length === 0 ? (
        <div className="p-6 rounded-xl bg-card border border-border/50 text-center text-muted-foreground text-sm">
          No active memberships
        </div>
      ) : (
        <div className="space-y-3">
          {subscriptions.map((sub) => (
            <div key={sub.id} className="p-4 rounded-xl bg-card border border-border/50 flex items-center justify-between">
              <div className="flex-1">
                <p className="font-bold">{sub.fan_email}</p>
                <p className="text-sm text-muted-foreground">{sub.tier_name} • {sub.artist_name}</p>
                <p className="text-xs text-muted-foreground font-mono mt-1">
                  Started: {format(new Date(sub.started_at), "MMM dd, yyyy")}
                  {sub.next_billing_date && ` • Renews: ${format(new Date(sub.next_billing_date), "MMM dd")}`}
                </p>
              </div>
              <Button onClick={() => handleDelete(sub.id)} variant="outline" size="sm" className="text-destructive border-destructive/40 hover:bg-destructive/10">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}