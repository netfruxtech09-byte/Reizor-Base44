import { useState, useEffect } from "react";
import { Gift, Users, ExternalLink, Copy, Check } from "lucide-react";
import { getAppUrl } from "@/lib/appUrl";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import LoyaltyTabSelector from "@/components/loyalty/LoyaltyTabSelector";
import LoyaltyPointsTierManager from "@/components/loyalty/LoyaltyPointsTierManager";
import PointsProgramMembersPanel from "@/components/loyalty/PointsProgramMembersPanel";
import ScanPointsSettings from "@/components/loyalty/ScanPointsSettings";

export default function OrganizerLoyaltyProgram() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const [activeTab, setActiveTab] = useState("points");

  useEffect(() => {
    (async () => {
      const u = await base44.auth.me();
      setUser(u);
      setLoading(false);
    })();
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5 max-w-3xl w-full pb-24 sm:pb-8">

      {/* Header */}
      <div>
        <h1 className="font-display font-black text-2xl sm:text-3xl tracking-tight">LOYALTY PROGRAM</h1>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
          One unified points program for your fans. They earn points by attending your events (ticket scanned at entry), following you, liking, commenting, reviewing, entering raffles, or voting in polls — and unlock reward tiers automatically.
        </p>
      </div>

      {/* Points-per-scan setting */}
      {user && <ScanPointsSettings ownerId={user.id} />}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <LoyaltyTabSelector
          value={activeTab}
          onValueChange={setActiveTab}
          options={[
            { value: "points", label: "Reward Tiers", icon: Gift },
            { value: "points-members", label: "Participants", icon: Users },
          ]}
        />

        <TabsContent value="points" className="mt-4">
          {user && <LoyaltyPointsTierManager ownerType="organizer" ownerId={user.id} ownerName={user.full_name || user.email} ownerEmail={user.email} />}
        </TabsContent>

        <TabsContent value="points-members" className="mt-4">
          {user && <PointsProgramMembersPanel ownerType="organizer" ownerId={user.id} />}
        </TabsContent>

      </Tabs>

      {/* Profile link card — bottom of page */}
      {user && (
        <div className="rounded-2xl bg-gradient-to-br from-primary/15 to-accent/10 border border-primary/40 overflow-hidden">
          <div className="px-5 pt-5 pb-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                <ExternalLink className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-display font-black text-base tracking-tight">Organizer Profile Link</p>
                <p className="text-xs text-muted-foreground">Your public page — share with fans to show your events &amp; loyalty program</p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-background/60 border border-border/60">
              <span className="flex-1 font-mono text-sm text-foreground truncate font-medium">
                {getAppUrl(`/organizers/${user.id}`)}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(getAppUrl(`/organizers/${user.id}`));
                  setCopiedLink(true);
                  toast.success("Profile link copied!");
                  setTimeout(() => setCopiedLink(false), 2500);
                }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-display font-bold transition-colors shadow-md"
              >
                {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copiedLink ? "Copied!" : "Copy Link"}
              </button>
              <a
                href={`/organizers/${user.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-accent hover:bg-accent/90 text-white text-sm font-display font-bold border border-accent/50 transition-colors"
              >
                <ExternalLink className="w-4 h-4" /> Open Profile
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}