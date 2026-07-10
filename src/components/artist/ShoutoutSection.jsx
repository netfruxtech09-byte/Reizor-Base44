import { useState } from "react";
import { Video, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { detectIsIOS } from "@/hooks/useIsIOS";

export default function ShoutoutSection({ artist, user }) {
  const price = artist.shoutout_price;
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ recipient_name: "", occasion: "", instructions: "" });
  const [submitting, setSubmitting] = useState(false);

  if (detectIsIOS()) return null;
  if (!price || price <= 0) return null;

  const handleSubmit = async () => {
    if (!user) { base44.auth.redirectToLogin(); return; }
    if (!form.recipient_name.trim()) { toast.error("Please enter the recipient's name"); return; }
    setSubmitting(true);
    const fee = parseFloat((price * 0.1).toFixed(2));
    const net = parseFloat((price - fee).toFixed(2));
    await base44.entities.ShoutoutRequest.create({
      artist_id: artist.id,
      artist_name: artist.display_name,
      artist_email: artist.user_email,
      fan_email: user.email,
      fan_name: user.full_name,
      recipient_name: form.recipient_name,
      occasion: form.occasion,
      instructions: form.instructions,
      amount: price,
      platform_fee: fee,
      net_amount: net,
      status: "pending",
      due_by: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
    // Notify artist
    await base44.integrations.Core.SendEmail({
      to: artist.user_email,
      subject: `🎤 New Shoutout Request — $${price.toFixed(2)}`,
      body: `${user.full_name || user.email} has requested a shoutout!\n\nFor: ${form.recipient_name}\nOccasion: ${form.occasion || "Not specified"}\nInstructions: ${form.instructions || "None"}\n\nYou have 7 days to deliver. Manage requests in your Shoutouts dashboard.`,
    }).catch(() => {});
    toast.success("Shoutout request sent! 🎤 The artist will deliver within 7 days.");
    setOpen(false);
    setForm({ recipient_name: "", occasion: "", instructions: "" });
    setSubmitting(false);
  };

  return (
    <div className="rounded-xl bg-card border border-border/50 overflow-hidden">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Video className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-display font-bold">Personalised Shoutout</p>
            <p className="text-xs text-muted-foreground font-mono">Get a custom video message from {artist.display_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono font-black text-primary">${price.toFixed(2)}</span>
          {!open && (
            <Button onClick={() => { if (!user) { base44.auth.redirectToLogin(); return; } setOpen(true); }}
              size="sm" className="glow-lime font-display font-bold">Request</Button>
          )}
        </div>
      </div>

      {open && (
        <div className="border-t border-border/30 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-mono text-muted-foreground">Who is this for? *</label>
              <Input value={form.recipient_name} onChange={e => setForm({ ...form, recipient_name: e.target.value })}
                placeholder="e.g. My friend Sarah" className="mt-1 bg-secondary border-border/50 text-sm" />
            </div>
            <div>
              <label className="text-xs font-mono text-muted-foreground">Occasion</label>
              <Input value={form.occasion} onChange={e => setForm({ ...form, occasion: e.target.value })}
                placeholder="Birthday, Anniversary..." className="mt-1 bg-secondary border-border/50 text-sm" />
            </div>
            <div>
              <label className="text-xs font-mono text-muted-foreground">Special instructions</label>
              <Input value={form.instructions} onChange={e => setForm({ ...form, instructions: e.target.value })}
                placeholder="Anything specific to say?" className="mt-1 bg-secondary border-border/50 text-sm" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSubmit} disabled={submitting} className="flex-1 glow-lime font-display font-bold gap-2">
              <Send className="w-4 h-4" />
              {submitting ? "Sending..." : `Request Shoutout — $${price.toFixed(2)}`}
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
          <p className="text-xs text-muted-foreground font-mono">Delivered within 7 days. 10% platform fee applies.</p>
        </div>
      )}
    </div>
  );
}