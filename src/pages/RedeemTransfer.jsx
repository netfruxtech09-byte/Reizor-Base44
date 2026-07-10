import { useState, useEffect } from "react";
import { Ticket, CheckCircle2, XCircle, Loader2, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "TKT-";
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export default function RedeemTransfer() {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get("token");

  const [transfer, setTransfer] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      if (!token) { setError("Invalid link — no transfer token."); setLoading(false); return; }

      const u = await base44.auth.me().catch(() => null);
      setUser(u);

      if (!u) {
        // Save token and redirect to login
        localStorage.setItem("pending_transfer_token", token);
        base44.auth.redirectToLogin(`/redeem-transfer?token=${token}`);
        return;
      }

      const records = await base44.entities.TicketTransfer.filter({ token }, null, 1).catch(() => []);
      const record = records[0];

      if (!record) { setError("Transfer not found or already claimed."); setLoading(false); return; }
      if (record.status === "claimed") { setError("This ticket has already been claimed."); setLoading(false); return; }
      if (record.status === "cancelled") { setError("This transfer was cancelled."); setLoading(false); return; }
      if (new Date(record.expires_at) < new Date()) { setError("This transfer link has expired."); setLoading(false); return; }
      if (record.to_email.toLowerCase() !== u.email.toLowerCase()) {
        setError(`This transfer was sent to ${record.to_email}. Please log in with that email.`);
        setLoading(false);
        return;
      }

      setTransfer(record);
      setLoading(false);
    })();
  }, [token]);

  const handleClaim = async () => {
    if (!transfer || !user) return;
    setClaiming(true);

    try {
      // Generate a brand new ticket code — completely different from original
      const newCode = generateCode();

      // Fetch original ticket to copy its data
      // Filter by ticket_code since we can't filter by id directly
      const origByCode = await base44.entities.Ticket.filter(
        { ticket_code: transfer.original_ticket_code },
        null, 1
      ).catch(() => []);
      // Also try fetching all tickets for the event to find by original_ticket_id
      let orig = origByCode[0];
      if (!orig && transfer.event_id) {
        const eventTickets = await base44.entities.Ticket.filter(
          { event_id: transfer.event_id },
          null, 200
        ).catch(() => []);
        orig = eventTickets.find(t => t.id === transfer.original_ticket_id);
      }

      if (!orig) {
        toast.error("We could not claim this ticket. Please try again or contact support.");
        setClaiming(false);
        return;
      }

      const res = await base44.functions.invoke("redeemTicketTransfer", {
        transfer_id: transfer.id,
        original_ticket_id: transfer.original_ticket_id,
        new_ticket_code: newCode,
        new_owner_email: user.email,
        new_owner_name: user.full_name || user.email,
        event_id: orig.event_id,
        event_title: orig.event_title,
        ticket_type_id: orig.ticket_type_id,
        ticket_type_name: orig.ticket_type_name,
        order_id: orig.order_id,
        price_paid: orig.price_paid,
      });

      if (res?.data?.error) {
        toast.error(res.data.error || "We could not claim this ticket. Please try again or contact support.");
        setClaiming(false);
        return;
      }

      // Send notification to sender
      base44.integrations.Core.SendEmail({
        to: transfer.from_email,
        subject: `Your transferred ticket has been claimed`,
        body: `Hi ${transfer.from_name || "there"},\n\n${user.full_name || user.email} has claimed the ticket you transferred for "${transfer.event_title}".\n\nThe transfer is now complete and your original ticket has been permanently invalidated.\n\nThank you for using Reizor!`,
      }).catch(() => {});

      setClaimed(true);
      toast.success("Ticket claimed successfully. You can now view it in My Tickets.");
    } catch (err) {
      toast.error("We could not claim this ticket. Please try again or contact support.");
    } finally {
      setClaiming(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  if (claimed) return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center space-y-4 max-w-sm">
        <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto" />
        <h2 className="font-display font-black text-3xl">Ticket Claimed!</h2>
        <p className="text-muted-foreground text-sm">Your new ticket is in your wallet with a fresh QR code. The original ticket from the sender is now invalid.</p>
        <Link to="/my-tickets">
          <Button className="glow-lime font-display font-bold gap-2 mt-2">
            <Ticket className="w-4 h-4" /> View My Tickets
          </Button>
        </Link>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center space-y-4 max-w-sm">
        <XCircle className="w-14 h-14 text-destructive mx-auto" />
        <h2 className="font-display font-black text-2xl">Transfer Error</h2>
        <p className="text-muted-foreground text-sm">{error}</p>
        <Link to="/my-tickets"><Button variant="outline">Go to My Tickets</Button></Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <span className="font-mono text-xs text-primary tracking-[0.3em] uppercase">🎟 Ticket Transfer</span>
          <h1 className="font-display font-black text-3xl mt-1">You've Got a Ticket!</h1>
          <p className="text-sm text-muted-foreground mt-1">
            <span className="text-foreground font-bold">{transfer?.from_name}</span> is transferring a ticket to you.
          </p>
        </div>

        {/* Ticket preview */}
        <div className="p-5 rounded-2xl bg-card border border-primary/30 space-y-3">
          <div>
            <p className="font-display font-black text-xl">{transfer?.event_title}</p>
            <p className="text-sm text-primary font-mono mt-0.5">{transfer?.ticket_type_name}</p>
          </div>
          <div className="text-xs text-muted-foreground font-mono border-t border-border/50 pt-3 space-y-1">
            <p>From: <span className="text-foreground">{transfer?.from_name} ({transfer?.from_email})</span></p>
            <p>To: <span className="text-foreground">{transfer?.to_email}</span></p>
            {transfer?.expires_at && (
              <p>Expires: <span className="text-yellow-400">{new Date(transfer.expires_at).toLocaleString()}</span></p>
            )}
          </div>
        </div>

        <div className="text-xs text-muted-foreground font-mono p-3 rounded-lg bg-secondary border border-border/50">
          ✓ Claiming will generate a <span className="text-foreground font-bold">new unique QR code</span> for you — the sender's original code becomes permanently invalid.
        </div>

        <Button
          onClick={handleClaim}
          disabled={claiming}
          className="w-full glow-lime font-display font-bold text-base h-12 gap-2"
        >
          {claiming ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
          {claiming ? "Claiming..." : "Claim This Ticket"}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          Logged in as <span className="text-foreground font-mono">{user?.email}</span>
        </p>
      </div>
    </div>
  );
}