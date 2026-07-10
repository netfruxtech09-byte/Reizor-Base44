import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { User, Mail, ExternalLink, Zap } from "lucide-react";

export default function EmbedSellerProfile() {
  const { id } = useParams();
  const [sellerLink, setSellerLink] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.SellerLink.filter({ id }, null, 1).then(sellers => {
      if (sellers[0]) setSellerLink(sellers[0]);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  if (!sellerLink) return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <p className="text-muted-foreground text-center">Ticket seller profile not found.</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-md mx-auto space-y-6">
        {/* Avatar */}
        <div className="flex justify-center">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="w-8 h-8 text-primary" />
          </div>
        </div>

        {/* Seller Name */}
        <div className="text-center space-y-1">
          <h1 className="font-display font-black text-2xl text-foreground">
            {sellerLink.seller_name || sellerLink.seller_email}
          </h1>
          <p className="text-xs text-muted-foreground">Ticket Seller</p>
        </div>

        {/* Info Cards */}
        <div className="space-y-2">
          {sellerLink.seller_email && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border/50">
              <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-sm text-foreground">{sellerLink.seller_email}</span>
            </div>
          )}

          {sellerLink.is_active && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-green-400/10 border border-green-400/20">
              <Zap className="w-4 h-4 text-green-400 shrink-0" />
              <span className="text-sm text-green-400">Active Seller</span>
            </div>
          )}
        </div>

        {/* Link to seller profile / get ticket link */}
        <a
          href={`${window.location.origin}/resale-marketplace?seller=${id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 p-3 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors"
        >
          <span>View Seller Tickets</span>
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
}