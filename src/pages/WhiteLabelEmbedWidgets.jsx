import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import EmbedCodePanel from "@/components/shared/EmbedCodePanel";
import { Code2 } from "lucide-react";

const WHITE_LABEL_WIDGETS = [
  { key: "profile", label: "White Label Profile", path: "profile" },
];

export default function WhiteLabelEmbedWidgets() {
  const [whiteLabelId, setWhiteLabelId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.auth.me().then(async (u) => {
      if (!u) { setLoading(false); return; }
      // Get white label by email
      const wls = await base44.entities.WhiteLabel.filter({ email: u.email }, null, 1).catch(() => []);
      if (wls[0]) {
        setWhiteLabelId(wls[0].id);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  if (!whiteLabelId) return (
    <div className="text-center py-20 text-muted-foreground text-sm">
      White label profile required to use embed widgets.
    </div>
  );

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Code2 className="w-5 h-5 text-primary" />
          <h1 className="font-display font-black text-2xl tracking-tight">Website Widgets</h1>
        </div>
        <p className="text-sm text-muted-foreground">Embed Reizor widgets on your external website to promote your brand.</p>
      </div>
      <EmbedCodePanel type="white-label" id={whiteLabelId} widgets={WHITE_LABEL_WIDGETS} />
    </div>
  );
}