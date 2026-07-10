import { useState, useEffect } from "react";
import { CreditCard, Trash2, Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function PaymentMethodManager({ userEmail }) {
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    base44.entities.PaymentMethod.filter({ user_email: userEmail }, null, 10).then((m) => {
      setMethods(m);
      setLoading(false);
    });
  }, [userEmail]);

  const handleSetDefault = async (methodId) => {
    await base44.entities.PaymentMethod.update(methodId, { is_default: true });
    setMethods((prev) =>
      prev.map((m) => ({
        ...m,
        is_default: m.id === methodId,
      }))
    );
    toast.success("Default payment method updated");
  };

  const handleDelete = async (methodId) => {
    if (!confirm("Delete this card?")) return;
    await base44.entities.PaymentMethod.delete(methodId);
    setMethods((prev) => prev.filter((m) => m.id !== methodId));
    toast.success("Card deleted");
  };

  if (loading) return <div className="flex items-center justify-center py-4"><div className="w-4 h-4 border-2 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold">Payment Methods</h3>
        <Button onClick={() => setShowForm(!showForm)} size="sm" className="gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Add Card
        </Button>
      </div>

      {showForm && (
        <div className="p-4 rounded-xl bg-muted border border-border/50">
          <p className="text-sm text-muted-foreground mb-3">
            Securely add a card for automatic membership renewal. Your card details are encrypted and stored by Stripe.
          </p>
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 text-xs text-muted-foreground">
            🔒 Card management integration coming soon. For now, manage cards in your account settings.
          </div>
          <Button variant="outline" onClick={() => setShowForm(false)} className="mt-3 w-full">
            Close
          </Button>
        </div>
      )}

      {methods.length === 0 ? (
        <div className="p-4 rounded-xl bg-card border border-border/50 text-center text-muted-foreground text-sm">
          No payment methods saved. Add a card to enable automatic renewal.
        </div>
      ) : (
        <div className="space-y-3">
          {methods.map((method) => (
            <div
              key={method.id}
              className="p-4 rounded-xl bg-card border border-border/50 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-bold text-sm">
                    {method.card_brand?.charAt(0).toUpperCase() + method.card_brand?.slice(1)} •••• {method.card_last_four}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Expires {method.expiry_month}/{method.expiry_year}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {method.is_default && (
                  <span className="flex items-center gap-1 text-xs font-mono text-primary bg-primary/10 px-2 py-1 rounded">
                    <Check className="w-3 h-3" /> Default
                  </span>
                )}
                {!method.is_default && (
                  <Button onClick={() => handleSetDefault(method.id)} variant="outline" size="sm" text="xs">
                    Set Default
                  </Button>
                )}
                <Button
                  onClick={() => handleDelete(method.id)}
                  variant="outline"
                  size="sm"
                  className="text-destructive border-destructive/40 hover:bg-destructive/10"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}