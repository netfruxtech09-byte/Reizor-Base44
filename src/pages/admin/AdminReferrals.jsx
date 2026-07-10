import { useState, useEffect } from "react";
import { Edit, Trash2, Lock, Unlock, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { toast } from "sonner";

export default function AdminReferrals() {
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [filter, setFilter] = useState({ type: "", status: "", email: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    base44.auth.me().then(async (u) => {
      if (!u || u.role !== "admin") {
        setLoading(false);
        return;
      }
      setUser(u);
      const refs = await base44.entities.Referral.filter({}, "-created_date", 500);
      setReferrals(refs);
      setLoading(false);
    });
  }, []);

  const filtered = referrals.filter((r) => {
    if (filter.type && r.referral_type !== filter.type) return false;
    if (filter.status && r.status !== filter.status) return false;
    if (filter.email && !r.referrer_email.toLowerCase().includes(filter.email.toLowerCase()) && !r.referred_email.toLowerCase().includes(filter.email.toLowerCase())) return false;
    return true;
  });

  const handleEdit = (ref) => {
    setEditingId(ref.id);
    setEditForm({
      credit_earned: ref.credit_earned,
      status: ref.status,
      comp_tier_committed: ref.comp_tier_committed,
    });
  };

  const handleSave = async (refId) => {
    setSaving(true);
    try {
      const updated = await base44.entities.Referral.update(refId, editForm);
      setReferrals((prev) => prev.map((r) => (r.id === refId ? updated : r)));
      setEditingId(null);
      toast.success("Referral updated");
    } catch (e) {
      toast.error("Failed to update referral");
    }
    setSaving(false);
  };

  const handleDelete = async (refId) => {
    if (!window.confirm("Permanently delete this referral?")) return;
    try {
      await base44.entities.Referral.delete(refId);
      setReferrals((prev) => prev.filter((r) => r.id !== refId));
      toast.success("Referral deleted");
    } catch {
      toast.error("Failed to delete referral");
    }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;
  if (!user || user.role !== "admin") return <div className="text-center py-20 text-muted-foreground">Access denied</div>;

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="font-display font-black text-3xl tracking-tight">REFERRAL MANAGEMENT</h1>
        <p className="text-sm text-muted-foreground mt-1">Edit, terminate, or modify referral programs globally</p>
      </div>

      {/* Filters */}
      <div className="p-4 rounded-xl bg-card border border-border/50 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <Label className="text-xs font-mono text-muted-foreground">Type</Label>
          <select
            value={filter.type}
            onChange={(e) => setFilter((f) => ({ ...f, type: e.target.value }))}
            className="mt-1 w-full rounded-md bg-secondary border border-border/50 px-3 py-2 text-sm"
          >
            <option value="">All types</option>
            <option value="ticket">Ticket</option>
            <option value="fan_membership">Fan Membership</option>
          </select>
        </div>
        <div>
          <Label className="text-xs font-mono text-muted-foreground">Status</Label>
          <select
            value={filter.status}
            onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))}
            className="mt-1 w-full rounded-md bg-secondary border border-border/50 px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="locked">Locked</option>
            <option value="withdrawn">Withdrawn</option>
          </select>
        </div>
        <div>
          <Label className="text-xs font-mono text-muted-foreground">Email Search</Label>
          <Input
            value={filter.email}
            onChange={(e) => setFilter((f) => ({ ...f, email: e.target.value }))}
            placeholder="Referrer or referred email..."
            className="mt-1 bg-secondary border-border/50"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-border/50">
        <table className="w-full text-sm">
          <thead className="bg-card border-b border-border/30">
            <tr>
              <th className="px-4 py-3 text-left font-bold">Referrer</th>
              <th className="px-4 py-3 text-left font-bold">Referred</th>
              <th className="px-4 py-3 text-left font-bold">Type</th>
              <th className="px-4 py-3 text-left font-bold">Status</th>
              <th className="px-4 py-3 text-left font-bold">$ Credit</th>
              <th className="px-4 py-3 text-left font-bold">Unlock Date</th>
              <th className="px-4 py-3 text-left font-bold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No referrals found</td>
              </tr>
            ) : (
              filtered.map((ref) => (
                <tr key={ref.id} className={editingId === ref.id ? "bg-primary/10" : "hover:bg-muted/40"}>
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-mono text-xs font-bold">{ref.referrer_name}</p>
                      <p className="text-xs text-muted-foreground">{ref.referrer_email}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-mono text-xs font-bold">{ref.referred_name}</p>
                      <p className="text-xs text-muted-foreground">{ref.referred_email}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded bg-primary/10 text-primary">
                      {ref.referral_type?.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {editingId === ref.id ? (
                      <select
                        value={editForm.status}
                        onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
                        className="px-2 py-1 rounded-md bg-secondary border border-border/50 text-xs"
                      >
                        <option value="pending">Pending</option>
                        <option value="completed">Completed</option>
                        <option value="locked">Locked</option>
                        <option value="withdrawn">Withdrawn</option>
                      </select>
                    ) : (
                      <span className={`font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                        ref.status === "completed" ? "text-green-400 bg-green-400/10" :
                        ref.status === "locked" ? "text-yellow-400 bg-yellow-400/10" :
                        ref.status === "withdrawn" ? "text-muted-foreground bg-muted" :
                        "text-accent bg-accent/10"
                      }`}>
                        {ref.status}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editingId === ref.id ? (
                      <Input
                        type="number"
                        value={editForm.credit_earned}
                        onChange={(e) => setEditForm((f) => ({ ...f, credit_earned: parseFloat(e.target.value) || 0 }))}
                        className="w-20 bg-secondary border-border/50 text-xs px-2 py-1 h-7"
                      />
                    ) : (
                      <span className="font-mono font-bold text-primary">${ref.credit_earned?.toFixed(2) || "0.00"}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {ref.unlock_date ? format(new Date(ref.unlock_date), "MMM dd, yyyy") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {editingId === ref.id ? (
                      <div className="flex gap-1">
                        <Button size="sm" onClick={() => handleSave(ref.id)} disabled={saving} className="h-7 px-2 font-display font-bold text-xs">
                          {saving ? "..." : "Save"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingId(null)} className="h-7 px-2">Cancel</Button>
                      </div>
                    ) : (
                      <div className="flex gap-1">
                        <button onClick={() => handleEdit(ref)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Edit">
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(ref.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">Total: {filtered.length} referral(s) · Showing ${filtered.reduce((s, r) => s + (r.credit_earned || 0), 0).toFixed(2)} in credits</p>
    </div>
  );
}