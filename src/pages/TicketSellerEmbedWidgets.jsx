import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import EmbedCodePanel from "@/components/shared/EmbedCodePanel";
import { Code2 } from "lucide-react";

const TICKET_SELLER_WIDGETS = [
  { key: "profile", label: "Seller Link & Profile", path: "profile" },
];

export default function TicketSellerEmbedWidgets() {
  const [sellerLinkId, setSellerLinkId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.auth.me().then(async (u) => {
      if (!u) { setLoading(false); return; }
      // Get seller link by email
      const sellers = await base44.entities.SellerLink.filter({ seller_email: u.email }, null, 1).catch(() => []);
      if (sellers[0]) {
        setSellerLinkId(sellers[0].id);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  if (!sellerLinkId) return (
    <div className="text-center py-20 text-muted-foreground text-sm">
      Ticket seller profile required to use embed widgets.
    </div>
  );

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Code2 className="w-5 h-5 text-primary" />
          <h1 className="font-display font-black text-2xl tracking-tight">Website Widgets</h1>
        </div>
        <p className="text-sm text-muted-foreground">Embed your ticket seller profile on your external website to promote your ticket sales.</p>
      </div>
      <EmbedCodePanel type="seller" id={sellerLinkId} widgets={TICKET_SELLER_WIDGETS} />
    </div>
  );
}