import { useState, useEffect } from "react";
import { Bell, Users, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function WaitlistManager({ event }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notifying, setNotifying] = useState(false);

  useEffect(() => {
    base44.entities.WaitlistEntry.filter({ event_id: event.id }, "-created_date", 200)
      .then(setEntries)
      .finally(() => setLoading(false));
  }, [event.id]);

  const notifyAll = async () => {
    const pending = entries.filter((e) => !e.notified);
    if (pending.length === 0) { toast.info("All users already notified"); return; }
    setNotifying(true);
    for (const entry of pending) {
      await base44.integrations.Core.SendEmail({
        to: entry.user_email,
        subject: `🎟️ Tickets available: ${event.title}`,
        body: `Hi ${entry.user_name || "there"},\n\nGreat news! Tickets are now available for ${event.title}.\n\nHead back to the event page to grab yours before they sell out again.\n\nSee you there! 🎉`,
      });
      await base44.entities.WaitlistEntry.update(entry.id, { notified: true });
    }
    setEntries((prev) => prev.map((e) => ({ ...e, notified: true })));
    setNotifying(false);
    toast.success(`Notified ${pending.length} waitlisted users!`);
  };

  const pendingCount = entries.filter((e) => !e.notified).length;

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-muted-foreground" />
          <span className="font-display font-bold">{entries.length} on waitlist</span>
          {pendingCount > 0 && (
            <span className="font-mono text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded font-bold">
              {pendingCount} unnotified
            </span>
          )}
        </div>
        <Button
          onClick={notifyAll}
          disabled={notifying || pendingCount === 0}
          size="sm"
          className="gap-2"
        >
          {notifying ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bell className="w-3 h-3" />}
          Notify All
        </Button>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8 bg-card rounded-lg border border-border/50">
          No one on the waitlist yet
        </p>
      ) : (
        <div className="bg-card rounded-lg border border-border/50 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left p-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">User</th>
                <th className="text-left p-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Signed Up</th>
                <th className="text-left p-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-border/30 last:border-0">
                  <td className="p-3">
                    <p className="font-medium">{e.user_name || "—"}</p>
                    <p className="text-xs text-muted-foreground">{e.user_email}</p>
                  </td>
                  <td className="p-3 font-mono text-xs text-muted-foreground">
                    {new Date(e.created_date).toLocaleDateString()}
                  </td>
                  <td className="p-3">
                    {e.notified ? (
                      <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-green-400">
                        <CheckCircle2 className="w-3 h-3" /> Notified
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono font-bold text-muted-foreground">Pending</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}