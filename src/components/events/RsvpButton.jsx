import { useState, useEffect } from "react";
import { Users, Star, Check, Clock } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuthGate } from "@/hooks/useAuthGate";
import { toast } from "sonner";
import { hapticMedium, hapticLight } from "@/lib/haptics";

export default function RsvpButton({ event }) {
  const [myRsvp, setMyRsvp] = useState(null);
  const [counts, setCounts] = useState({ going: 0, interested: 0, pending_approval: 0, approved: 0 });
  const [loading, setLoading] = useState(true);
  const { requireAuth } = useAuthGate();

  const isRsvpOnly = event?.event_type === "rsvp_only";
  const approvalRequired = event?.rsvp_approval_required !== false;

  useEffect(() => {
    (async () => {
      const [all, user] = await Promise.all([
        base44.entities.EventRsvp.filter({ event_id: event.id }, null, 500),
        base44.auth.me().catch(() => null),
      ]);
      setCounts({
        going: all.filter((r) => r.status === "going").length,
        interested: all.filter((r) => r.status === "interested").length,
        pending_approval: all.filter((r) => r.status === "pending_approval").length,
        approved: all.filter((r) => r.status === "approved").length,
      });
      if (user) {
        const mine = all.find((r) => r.user_email === user.email);
        if (mine) setMyRsvp({ id: mine.id, status: mine.status, ticket_code: mine.ticket_code });
      }
      setLoading(false);
    })();
  }, [event.id]);

  const handleRsvpOnly = async () => {
    const authed = await requireAuth("Sign in to request access to this event.");
    if (!authed) return;
    const user = await base44.auth.me().catch(() => null);
    if (!user) return;

    if (myRsvp) {
      hapticLight();
      await base44.entities.EventRsvp.delete(myRsvp.id);
      setMyRsvp(null);
      toast.success("RSVP request cancelled");
      return;
    }

    hapticMedium();
    const status = approvalRequired ? "pending_approval" : "approved";
    const created = await base44.entities.EventRsvp.create({
      event_id: event.id,
      event_title: event.title,
      user_email: user.email,
      user_name: user.full_name || user.email,
      status,
      rsvp_type: approvalRequired ? "approval_required" : "standard",
    });
    setMyRsvp({ id: created.id, status, ticket_code: created.ticket_code });
    toast.success(approvalRequired ? "RSVP request submitted! The organizer will review and notify you." : "You're on the list!");
  };

  const handleRsvp = async (newStatus) => {
    const authed = await requireAuth("Sign in to RSVP to this event.");
    if (!authed) return;
    const user = await base44.auth.me().catch(() => null);
    if (!user) return;

    if (myRsvp?.status === newStatus) {
      hapticLight();
      // Optimistic: remove immediately
      const prev = myRsvp;
      setMyRsvp(null);
      setCounts((c) => ({ ...c, [newStatus]: c[newStatus] - 1 }));
      base44.entities.EventRsvp.delete(prev.id).catch(() => {
        setMyRsvp(prev);
        setCounts((c) => ({ ...c, [newStatus]: c[newStatus] + 1 }));
      });
    } else if (myRsvp) {
      hapticMedium();
      // Optimistic: switch status immediately
      const prev = myRsvp;
      setMyRsvp({ ...myRsvp, status: newStatus });
      setCounts((c) => ({ ...c, [prev.status]: c[prev.status] - 1, [newStatus]: c[newStatus] + 1 }));
      base44.entities.EventRsvp.update(prev.id, { status: newStatus }).catch(() => {
        setMyRsvp(prev);
        setCounts((c) => ({ ...c, [newStatus]: c[newStatus] - 1, [prev.status]: c[prev.status] + 1 }));
      });
    } else {
      hapticMedium();
      // Optimistic: mark as RSVPed with temp id
      const optimistic = { id: `opt_${Date.now()}`, status: newStatus };
      setMyRsvp(optimistic);
      setCounts((c) => ({ ...c, [newStatus]: c[newStatus] + 1 }));
      base44.entities.EventRsvp.create({
        event_id: event.id,
        event_title: event.title,
        user_email: user.email,
        user_name: user.full_name || user.email,
        status: newStatus,
      }).then(created => {
        setMyRsvp({ id: created.id, status: newStatus });
      }).catch(() => {
        setMyRsvp(null);
        setCounts((c) => ({ ...c, [newStatus]: c[newStatus] - 1 }));
      });
    }
  };

  if (loading) return null;

  if (isRsvpOnly) {
    const isPending = myRsvp?.status === "pending_approval";
    const isApproved = myRsvp?.status === "approved";
    const totalApproved = counts.approved;
    const capacity = event.rsvp_capacity || 0;
    const isFull = capacity > 0 && totalApproved >= capacity;

    if (isApproved) {
      return (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-green-400/10 border border-green-400/30 text-green-400 text-sm font-mono font-bold">
            <Check className="w-3.5 h-3.5" /> You're Approved!
          </div>
          {myRsvp?.ticket_code && (
            <p className="font-mono text-[10px] text-muted-foreground text-center">Entry code: {myRsvp.ticket_code}</p>
          )}
        </div>
      );
    }

    if (isPending) {
      return (
        <button onClick={handleRsvpOnly}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-400/10 border border-yellow-400/30 text-yellow-400 text-sm font-mono font-bold hover:bg-yellow-400/20 transition-colors touch-manipulation"
          style={{ WebkitTapHighlightColor: "transparent" }}>
          <Clock className="w-3.5 h-3.5" /> Pending Approval — Cancel Request
        </button>
      );
    }

    return (
      <button onClick={handleRsvpOnly} disabled={isFull}
        className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-mono font-bold border transition-all touch-manipulation ${
          isFull ? "border-border/30 text-muted-foreground cursor-not-allowed" : "bg-accent/10 border-accent/40 text-accent hover:bg-accent/20"
        }`}
        style={{ WebkitTapHighlightColor: "transparent" }}>
        <Users className="w-3.5 h-3.5" />
        {isFull ? "RSVP Full" : approvalRequired ? "Request Access" : "RSVP Now"}
        {totalApproved > 0 && !isFull && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/20">{totalApproved}</span>}
      </button>
    );
  }

  const goingActive = myRsvp?.status === "going";
  const interestedActive = myRsvp?.status === "interested";

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button onClick={() => handleRsvp("going")}
        className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-mono font-bold border transition-all touch-manipulation ${
          goingActive ? "bg-primary text-primary-foreground border-primary glow-lime" : "bg-card border-border/50 text-muted-foreground hover:border-primary/50 hover:text-foreground"
        }`}
        style={{ WebkitTapHighlightColor: "transparent" }}>
        {goingActive ? <Check className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}
        Going
        {counts.going > 0 && <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${goingActive ? "bg-primary-foreground/20" : "bg-muted"}`}>{counts.going}</span>}
      </button>
      <button onClick={() => handleRsvp("interested")}
        className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-mono font-bold border transition-all touch-manipulation ${
          interestedActive ? "bg-accent text-accent-foreground border-accent" : "bg-card border-border/50 text-muted-foreground hover:border-accent/50 hover:text-foreground"
        }`}
        style={{ WebkitTapHighlightColor: "transparent" }}>
        {interestedActive ? <Check className="w-3.5 h-3.5" /> : <Star className="w-3.5 h-3.5" />}
        Interested
        {counts.interested > 0 && <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${interestedActive ? "bg-accent-foreground/20" : "bg-muted"}`}>{counts.interested}</span>}
      </button>
    </div>
  );
}