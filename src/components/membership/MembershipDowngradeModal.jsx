import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function MembershipDowngradeModal({ subscription, onClose, onSuccess }) {
  const [processing, setProcessing] = useState(false);

  const handleDowngrade = async () => {
    if (!confirm("This will immediately revoke all membership benefits. Continue?")) return;
    
    setProcessing(true);
    try {
      await base44.entities.FanSubscription.update(subscription.id, {
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
      });

      // Send confirmation email
      await base44.integrations.Core.SendEmail({
        to: subscription.fan_email,
        subject: "Membership Cancelled",
        body: `Hi ${subscription.fan_name},

Your ${subscription.tier_name} membership has been cancelled effective immediately. You no longer have access to membership benefits.

If you'd like to reactivate, you can sign up again anytime from your profile.

Thank you!`,
      });

      toast.success("Membership cancelled");
      onSuccess();
      onClose();
    } catch (error) {
      toast.error("Failed to cancel membership");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl border border-border/50 max-w-sm w-full space-y-4 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
            <h3 className="font-display font-bold">Cancel Membership?</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Cancelling your {subscription.tier_name} membership will:
          </p>
          <ul className="space-y-2 pl-4 border-l-2 border-destructive/30">
            <li className="text-destructive">❌ Revoke all membership benefits immediately</li>
            <li className="text-destructive">❌ Stop automatic renewal charges</li>
            <li className="text-destructive">❌ Lose access to exclusive perks</li>
          </ul>
          <p className="text-xs text-muted-foreground italic">
            This action cannot be undone. You can re-join anytime.
          </p>
        </div>

        <div className="flex gap-3 pt-2">
          <Button onClick={onClose} variant="outline" className="flex-1">
            Keep Membership
          </Button>
          <Button
            onClick={handleDowngrade}
            disabled={processing}
            className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {processing ? "Cancelling..." : "Cancel"}
          </Button>
        </div>
      </div>
    </div>
  );
}