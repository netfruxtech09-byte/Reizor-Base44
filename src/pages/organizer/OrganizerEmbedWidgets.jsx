import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import EmbedCodePanel from "@/components/shared/EmbedCodePanel";
import { Code2 } from "lucide-react";

const ORGANIZER_WIDGETS = [
  { key: "profile",      label: "Profile Card",     path: "profile" },
  { key: "events",       label: "Upcoming Events",  path: "events" },
  { key: "raffles-polls",label: "Raffles & Polls",  path: "raffles-polls" },

];

export default function OrganizerEmbedWidgets() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  if (!user) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Code2 className="w-5 h-5 text-primary" />
          <h1 className="font-display font-black text-2xl tracking-tight">Website Widgets</h1>
        </div>
        <p className="text-sm text-muted-foreground">Embed Reizor widgets on your external website to promote your events and content.</p>
      </div>
      <EmbedCodePanel type="organizer" id={user.id} widgets={ORGANIZER_WIDGETS} />
    </div>
  );
}