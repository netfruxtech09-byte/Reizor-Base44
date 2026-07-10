import { useState } from "react";
import { Send, X, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

function generateToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

export default function TransferTicketModal({ ticket, event, user, onClose, onTransferred }) {
  const [toEmail, setToEmail] = useState("");
  const [sending, setSending] = useState(false);

  const handleTransfer = async () => {
    if (!toEmail.trim() || !toEmail.includes("@")) return toast.error("Enter a valid email address");
    if (toEmail.toLowerCase() === user.email.toLowerCase()) return toast.error("You can't transfer to yourself");

    setSending(true);
    try {
      const token = generateToken();
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      const recipientEmail = toEmail.toLowerCase().trim();

      // Create pending transfer record
      await base44.entities.TicketTransfer.create({
        original_ticket_id: ticket.id,
        original_ticket_code: ticket.ticket_code,
        event_id: ticket.event_id,
        event_title: ticket.event_title,
        ticket_type_name: ticket.ticket_type_name,
        price_paid: ticket.price_paid,
        from_email: user.email,
        from_name: user.full_name || user.email,
        to_email: recipientEmail,
        token,
        status: "pending",
        expires_at: expiresAt,
      });

      // Mark original ticket as locked for transfer
      await base44.entities.Ticket.update(ticket.id, { status: "transferred" });

      // Send notification email — failure here should NOT block success
      try {
        await base44.functions.invoke("sendTransferEmail", {
          to_email: recipientEmail,
          from_name: user.full_name || user.email,
          event_title: ticket.event_title,
          ticket_type_name: ticket.ticket_type_name,
          token,
        });
      } catch {
        // Email failed but transfer is complete — show warning, not error
        toast.warning("Transfer created but notification email could not be sent.");
      }

      toast.success(`Transfer sent to ${toEmail}! They have 48 hours to claim.`);
      onTransferred?.();
      onClose();
    } catch (err) {
      toast.error(err?.message || "Transfer failed. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const isLoyaltyTicket = ticket?.purchased_with_loyalty;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 space-y-5 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display font-black text-xl">Transfer Ticket</h2>
            <p className="text-xs text-muted-foreground mt-0.5 font-mono">{ticket.event_title}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {isLoyaltyTicket ? (
          <div className="p-5 rounded-xl bg-amber-400/10 border border-amber-400/20 text-center space-y-3">
            <p className="text-3xl">🎁</p>
            <p className="font-display font-bold text-amber-400">Reward tickets cannot be transferred</p>
            <p className="text-xs text-muted-foreground">This ticket was earned through a loyalty reward and may only be used by the fan who received it.</p>
          </div>
        ) : (
          <>
        {/* Ticket summary */}
        <div className="p-3 rounded-lg bg-secondary border border-border/50 text-sm space-y-1">
          <p className="font-bold">{ticket.ticket_type_name}</p>
          <p className="text-xs text-muted-foreground font-mono">{ticket.ticket_code}</p>
        </div>

        {/* Warning */}
        <div className="p-3 rounded-lg bg-yellow-400/10 border border-yellow-400/20 text-xs text-yellow-400 font-mono leading-relaxed">
          ⚠ Once sent, your ticket will be locked until the recipient claims it or the transfer expires (48h). If unclaimed, it returns to you.
        </div>

        {/* Recipient email */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground font-mono">Recipient Email</Label>
          <Input
            value={toEmail}
            onChange={e => setToEmail(e.target.value)}
            placeholder="friend@email.com"
            type="email"
            className="bg-secondary border-border/50"
            onKeyDown={e => e.key === "Enter" && handleTransfer()}
            autoFocus
          />
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button
            onClick={handleTransfer}
            disabled={sending || !toEmail.trim()}
            className="flex-1 glow-lime font-display font-bold gap-2"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {sending ? "Sending..." : "Send Transfer"}
          </Button>
        </div>
          </>
        )}
      </div>
    </div>
  );
}