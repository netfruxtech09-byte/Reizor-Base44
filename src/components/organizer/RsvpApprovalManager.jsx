import { useState, useEffect, useCallback } from "react";
import { CheckCircle, XCircle, Clock, Users, Check, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { sendEmail } from "@/utils/emailService";
import { buildEmailBody } from "@/utils/emailTemplate";
import { format } from "date-fns";

function generateTicketCode() {
  return "RSVP-" + Math.random().toString(36).slice(2, 10).toUpperCase();
}

export default function RsvpApprovalManager({ event }) {
  const [rsvps, setRsvps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [filter, setFilter] = useState("pending_approval");
  const [currentUser, setCurrentUser] = useState(null);

  const load = useCallback(async () => {
    const [data, user] = await Promise.all([
      base44.entities.EventRsvp.filter({ event_id: event.id }, "-created_date", 200).catch(() => []),
      base44.auth.me().catch(() => null),
    ]);
    setRsvps(data);
    setCurrentUser(user);
    setLoading(false);
  }, [event.id]);

  useEffect(() => { load(); }, [load]);

  const approveOne = async (rsvp) => {
    setActionLoading(rsvp.id);
    const ticketCode = generateTicketCode();
    const now = new Date().toISOString();
    await base44.entities.EventRsvp.update(rsvp.id, {
      status: "approved",
      ticket_code: ticketCode,
      approved_at: now,
      approved_by: currentUser?.email || "",
    });

    // Send approval email with QR info
    const eventUrl = `${window.location.origin}/events/${event.id}`;
    try {
      await sendEmail({
        _source: "RsvpApprovalManager/approve",
        to: rsvp.user_email,
        subject: `✅ RSVP Approved: ${event.title}`,
        body: buildEmailBody({
          title: "✅ Your RSVP is Approved!",
          greeting: `Hi ${rsvp.user_name || rsvp.user_email},`,
          message: `Great news! Your RSVP for <strong>${event.title}</strong> has been approved.`,
          infoBox: {
            highlight: true,
            rows: [
              { label: "Event", value: event.title },
              { label: "Date", value: event.date ? format(new Date(event.date), "MMM dd, yyyy h:mm a") : "TBA" },
              { label: "Venue", value: event.venue_name || "TBA" },
              { label: "Your Code", value: ticketCode },
            ],
          },
          extraLines: ["Show your entry code at the door. You can also find it in My Tickets."],
          ctaText: "View My Tickets →",
          ctaUrl: `${window.location.origin}/my-tickets`,
          footerNote: "Entry code: " + ticketCode,
        }),
      });
    } catch {}

    // In-app notification
    await base44.entities.Notification.create({
      user_email: rsvp.user_email,
      title: `✅ RSVP Approved: ${event.title}`,
      message: `Your RSVP has been approved! Your entry code is ${ticketCode}. Check My Tickets.`,
      type: "general",
      event_id: event.id,
      event_title: event.title,
      link: "/my-tickets",
    }).catch(() => {});

    toast.success(`Approved ${rsvp.user_name || rsvp.user_email}`);
    setActionLoading(null);
    load();
  };

  const rejectOne = async (rsvp) => {
    setActionLoading(rsvp.id);
    await base44.entities.EventRsvp.update(rsvp.id, {
      status: "rejected",
      rejected_at: new Date().toISOString(),
    });
    try {
      await sendEmail({
        _source: "RsvpApprovalManager/reject",
        to: rsvp.user_email,
        subject: `RSVP Update: ${event.title}`,
        body: buildEmailBody({
          title: "RSVP Update",
          greeting: `Hi ${rsvp.user_name || rsvp.user_email},`,
          message: `Unfortunately, we're unable to accommodate your RSVP request for <strong>${event.title}</strong> at this time.`,
          extraLines: ["Thank you for your interest. We hope to see you at a future event!"],
          ctaText: "Browse Other Events →",
          ctaUrl: window.location.origin,
        }),
      });
    } catch {}
    toast.success("RSVP rejected");
    setActionLoading(null);
    load();
  };

  const bulkApprove = async () => {
    const pending = rsvps.filter(r => r.status === "pending_approval");
    if (!pending.length) return;
    if (!window.confirm(`Approve all ${pending.length} pending RSVPs?`)) return;
    setActionLoading("bulk");
    for (const r of pending) {
      const ticketCode = generateTicketCode();
      await base44.entities.EventRsvp.update(r.id, {
        status: "approved",
        ticket_code: ticketCode,
        approved_at: new Date().toISOString(),
        approved_by: currentUser?.email || "",
      });
      try {
        await base44.entities.Notification.create({
          user_email: r.user_email,
          title: `✅ RSVP Approved: ${event.title}`,
          message: `Your RSVP has been approved! Entry code: ${ticketCode}`,
          type: "general",
          event_id: event.id,
          event_title: event.title,
          link: "/my-tickets",
        });
      } catch {}
    }
    toast.success(`${pending.length} RSVPs approved!`);
    setActionLoading(null);
    load();
  };

  const filtered = rsvps.filter(r => filter === "all" ? true : r.status === filter);
  const counts = {
    pending_approval: rsvps.filter(r => r.status === "pending_approval").length,
    approved: rsvps.filter(r => r.status === "approved").length,
    rejected: rsvps.filter(r => r.status === "rejected").length,
  };

  const capacity = event.rsvp_capacity || 0;
  const approvedCount = counts.approved;

  if (loading) return <div className="py-4 flex justify-center"><div className="w-5 h-5 border-2 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-accent" />
            <h3 className="font-display font-bold text-lg">RSVP APPROVALS</h3>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Review and approve guest RSVP requests for this event.</p>
        </div>
        {counts.pending_approval > 0 && (
          <Button size="sm" onClick={bulkApprove} disabled={actionLoading === "bulk"}
            className="gap-1.5 bg-green-500 hover:bg-green-400 text-black font-bold">
            <Check className="w-3.5 h-3.5" />
            {actionLoading === "bulk" ? "Approving…" : `Approve All (${counts.pending_approval})`}
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-lg bg-card border border-yellow-400/20 text-center">
          <p className="font-mono text-[10px] text-muted-foreground uppercase">Pending</p>
          <p className="font-mono font-bold text-yellow-400 text-xl">{counts.pending_approval}</p>
        </div>
        <div className="p-3 rounded-lg bg-card border border-green-400/20 text-center">
          <p className="font-mono text-[10px] text-muted-foreground uppercase">Approved</p>
          <p className="font-mono font-bold text-green-400 text-xl">{approvedCount}{capacity > 0 && <span className="text-muted-foreground text-sm font-normal"> / {capacity}</span>}</p>
        </div>
        <div className="p-3 rounded-lg bg-card border border-destructive/20 text-center">
          <p className="font-mono text-[10px] text-muted-foreground uppercase">Rejected</p>
          <p className="font-mono font-bold text-destructive text-xl">{counts.rejected}</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: "pending_approval", label: "Pending" },
          { key: "approved", label: "Approved" },
          { key: "rejected", label: "Rejected" },
          { key: "all", label: "All" },
        ].map(tab => (
          <button key={tab.key} onClick={() => setFilter(tab.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-colors ${filter === tab.key ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border/50 text-muted-foreground hover:border-primary/40"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground text-sm font-mono">
          No {filter === "all" ? "" : filter.replace("_", " ")} RSVPs yet.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(r => (
            <div key={r.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-card border border-border/50 flex-wrap">
              <div className="min-w-0">
                <p className="font-medium text-sm">{r.user_name || r.user_email}</p>
                <p className="font-mono text-xs text-muted-foreground">{r.user_email}</p>
                {r.notes && <p className="text-xs text-muted-foreground mt-0.5 italic">"{r.notes}"</p>}
                {r.ticket_code && (
                  <p className="font-mono text-[10px] text-green-400 mt-0.5">Code: {r.ticket_code}</p>
                )}
                <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
                  {r.created_date ? format(new Date(r.created_date), "MMM d, yyyy h:mm a") : ""}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {r.status === "pending_approval" && (
                  <>
                    <Button size="sm" onClick={() => approveOne(r)} disabled={actionLoading === r.id}
                      className="h-7 gap-1 bg-green-500 hover:bg-green-400 text-black font-bold text-xs">
                      <CheckCircle className="w-3 h-3" /> {actionLoading === r.id ? "…" : "Approve"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => rejectOne(r)} disabled={actionLoading === r.id}
                      className="h-7 gap-1 border-destructive/40 text-destructive hover:bg-destructive/10 text-xs">
                      <XCircle className="w-3 h-3" /> Reject
                    </Button>
                  </>
                )}
                {r.status === "approved" && (
                  <span className="font-mono text-[10px] font-bold px-2 py-1 rounded bg-green-400/10 text-green-400 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> Approved
                  </span>
                )}
                {r.status === "rejected" && (
                  <span className="font-mono text-[10px] font-bold px-2 py-1 rounded bg-destructive/10 text-destructive flex items-center gap-1">
                    <XCircle className="w-3 h-3" /> Rejected
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}