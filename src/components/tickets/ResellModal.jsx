import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { Tag, AlertTriangle, Share2, Copy, Check } from "lucide-react";
import { detectIsIOS } from "@/hooks/useIsIOS";

export default function ResellModal({ ticket, event, open, onClose, onListed }) {
  const [price, setPrice] = useState(ticket?.price_paid || "");
  const [saving, setSaving] = useState(false);
  const [listed, setListed] = useState(false);
  const [copied, setCopied] = useState(false);

  if (detectIsIOS()) return null;

  const originalPrice = ticket?.price_paid || 0;
  const discount = originalPrice > 0 ? originalPrice - Number(price) : 0;

  const handleList = async () => {
    if (ticket?.purchased_with_loyalty) return toast.error("Reward tickets cannot be resold");
    if (!price || Number(price) <= 0) return toast.error("Enter a valid price");
    if (originalPrice > 0 && Number(price) > originalPrice) {
      toast.error(`Resale price cannot exceed original price ($${originalPrice.toFixed(2)})`);
      return;
    }
    setSaving(true);
    const user = await base44.auth.me();
    await base44.entities.TicketListing.create({
      ticket_id: ticket.id,
      ticket_code: ticket.ticket_code,
      event_id: ticket.event_id,
      event_title: ticket.event_title,
      ticket_type_name: ticket.ticket_type_name,
      seller_email: user.email,
      seller_name: user.full_name || user.email,
      original_price: ticket.price_paid || 0,
      resale_price: Number(price),
      organizer_id: event?.organizer_id || "",
      status: "active",
    });
    toast.success("Ticket listed for resale!");
    setSaving(false);
    setListed(true);
    onListed();
  };

  const resaleUrl = `${window.location.origin}/resale`;
  const shareText = `🎟️ I'm selling my ticket to ${ticket?.event_title} on Reizor! Grab it before it's gone:`;

  const shareLinks = [
    {
      label: "X / Twitter",
      color: "bg-black hover:bg-black/80",
      icon: "𝕏",
      url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(resaleUrl)}`,
    },
    {
      label: "Facebook",
      color: "bg-[#1877F2] hover:bg-[#1877F2]/80",
      icon: "f",
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(resaleUrl)}&quote=${encodeURIComponent(shareText)}`,
    },
    {
      label: "WhatsApp",
      color: "bg-[#25D366] hover:bg-[#25D366]/80",
      icon: "💬",
      url: `https://wa.me/?text=${encodeURIComponent(shareText + " " + resaleUrl)}`,
    },
    {
      label: "Telegram",
      color: "bg-[#229ED9] hover:bg-[#229ED9]/80",
      icon: "✈️",
      url: `https://t.me/share/url?url=${encodeURIComponent(resaleUrl)}&text=${encodeURIComponent(shareText)}`,
    },
  ];

  const handleCopy = async () => {
    await navigator.clipboard.writeText(`${shareText} ${resaleUrl}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isLoyaltyTicket = ticket?.purchased_with_loyalty;

  return (
    <Dialog open={open} onOpenChange={() => { setListed(false); onClose(); }}>
      <DialogContent className="max-w-sm bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-display font-black text-xl tracking-tight flex items-center gap-2">
            <Tag className="w-5 h-5 text-primary" /> LIST FOR RESALE
          </DialogTitle>
        </DialogHeader>
        {isLoyaltyTicket ? (
          <div className="space-y-4 pt-2">
            <div className="p-5 rounded-xl bg-amber-400/10 border border-amber-400/20 text-center space-y-3">
              <p className="text-3xl">🎁</p>
              <p className="font-display font-bold text-amber-400">Reward tickets cannot be resold</p>
              <p className="text-xs text-muted-foreground">This ticket was earned through a loyalty reward and may only be used by the fan who received it.</p>
            </div>
            <Button variant="outline" onClick={onClose} className="w-full border-border/50">Close</Button>
          </div>
        ) : listed ? (
          <div className="space-y-4 pt-2">
            <div className="p-4 rounded-lg bg-primary/10 border border-primary/30 text-center">
              <p className="text-2xl mb-1">🎉</p>
              <p className="font-display font-bold">Ticket Listed!</p>
              <p className="text-xs text-muted-foreground mt-1 font-mono">Share it so someone can buy it fast.</p>
            </div>

            <div className="flex items-center gap-2 mb-1">
              <Share2 className="w-4 h-4 text-primary" />
              <span className="font-mono text-xs font-bold uppercase tracking-widest text-primary">Share to Social</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {shareLinks.map((s) => (
                <a
                  key={s.label}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-white text-sm font-bold transition-opacity ${s.color}`}
                >
                  <span className="text-base">{s.icon}</span> {s.label}
                </a>
              ))}
            </div>

            <button
              onClick={handleCopy}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-border/50 text-sm font-mono text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied!" : "Copy Link"}
            </button>

            <Button variant="outline" onClick={() => { setListed(false); onClose(); }} className="w-full border-border/50">
              Done
            </Button>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <div className="p-3 rounded-lg bg-secondary/50 border border-border/50">
              <p className="font-bold text-sm">{ticket?.event_title}</p>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">{ticket?.ticket_type_name}</p>
              <p className="text-xs text-muted-foreground font-mono">Original: ${ticket?.price_paid?.toFixed(2)}</p>
            </div>

            <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/20 space-y-2">
              <div className="flex gap-2 text-xs text-amber-400">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>Resale ticket price cannot exceed original paid amount including the fees.</span>
              </div>
              <p className="text-xs font-mono font-bold text-amber-400 pl-6">The ticket selling price cannot exceed the total price originally paid for the ticket.</p>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground font-mono">RESALE PRICE (USD)</Label>
              <Input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                max={originalPrice > 0 ? originalPrice : undefined}
                className="mt-1 bg-secondary border-border/50 text-lg font-mono"
              />
              {originalPrice > 0 && Number(price) > 0 && (
                <div className="mt-1.5 space-y-0.5">
                  {Number(price) > originalPrice ? (
                    <p className="text-xs text-destructive font-mono">⚠ Cannot exceed original price (${originalPrice.toFixed(2)})</p>
                  ) : discount > 0 ? (
                    <p className="text-xs text-green-400 font-mono">🏷 ${discount.toFixed(2)} off original price — buyers will see this discount</p>
                  ) : (
                    <p className="text-xs text-muted-foreground font-mono">Same as original price</p>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button className="flex-1 glow-lime font-display font-bold" onClick={handleList} disabled={saving}>
                {saving ? "Listing..." : "List Ticket"}
              </Button>
              <Button variant="outline" onClick={onClose} className="border-border/50">Cancel</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}