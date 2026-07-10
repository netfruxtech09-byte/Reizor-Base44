import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Gift, Users } from "lucide-react";
import { base44 } from "@/api/base44Client";
import LoyaltyPointsTierManager from "@/components/loyalty/LoyaltyPointsTierManager";
import PointsProgramMembersPanel from "@/components/loyalty/PointsProgramMembersPanel";
import LoyaltyTabSelector from "@/components/loyalty/LoyaltyTabSelector";

export default function ArtistLoyaltyProgram() {
  const [artist, setArtist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("tiers");

  useEffect(() => {
    base44.auth.me().then(async (u) => {
      const artists = await base44.entities.Artist.filter({ user_email: u.email }, null, 1).catch(() => []);
      setArtist(artists[0] || null);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;
  if (!artist) return <p className="text-muted-foreground py-20 text-center">Artist profile not found.</p>;

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="font-display font-black text-2xl sm:text-3xl tracking-tight">LOYALTY & REWARDS</h1>
        <p className="text-sm text-muted-foreground mt-1">Create points-based reward tiers for your followers.</p>
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <LoyaltyTabSelector
          value={activeTab}
          onValueChange={setActiveTab}
          options={[
            { value: "tiers", label: "Reward Tiers", icon: Gift },
            { value: "participants", label: "Participants", icon: Users },
          ]}
        />
        <TabsContent value="tiers" className="mt-4">
          <LoyaltyPointsTierManager ownerType="artist" ownerId={artist.id} ownerName={artist.display_name} ownerEmail={artist.user_email} />
        </TabsContent>
        <TabsContent value="participants" className="mt-4">
          <PointsProgramMembersPanel ownerType="artist" ownerId={artist.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}