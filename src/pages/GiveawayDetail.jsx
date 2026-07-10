import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import GiveawayDetailModal from "@/components/giveaways/GiveawayDetailModal";
import PrizeGuideModal from "@/components/onboarding/PrizeGuideModal";
import { maybeTriggerPrizeGuide } from "@/lib/onboardingGuides";

export default function GiveawayDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [giveaway, setGiveaway] = useState(null);
  const [user, setUser] = useState(null);
  const [myEntry, setMyEntry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showPrizeGuide, setShowPrizeGuide] = useState(false);

  useEffect(() => {
    const run = async () => {
      const [u, g] = await Promise.all([
        base44.auth.me().catch(() => null),
        base44.entities.Giveaway.get(id).catch(() => null),
      ]);
      setUser(u);
      if (!g) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setGiveaway(g);
      if (u) {
        const entries = await base44.entities.GiveawayEntry.filter(
          { giveaway_id: id, user_email: u.email }, null, 5
        ).catch(() => []);
        setMyEntry(entries[0] || null);
      }
      setLoading(false);
    };
    run();
  }, [id]);

  const handleClose = () => {
    // Back to the giveaway listing
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/giveaways");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
        <p className="font-display font-bold text-xl">Giveaway not found</p>
        <Button variant="outline" onClick={() => navigate("/giveaways")} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to Giveaways
        </Button>
      </div>
    );
  }

  return (
    <>
      {giveaway && (
        <GiveawayDetailModal
          giveaway={giveaway}
          user={user}
          myEntry={myEntry}
          onClose={handleClose}
          onEntered={() => {
            // Refresh the user's entry state in-place, then maybe show the prize guide
            base44.entities.GiveawayEntry.filter(
              { giveaway_id: id, user_email: user?.email }, null, 5
            ).then(e => setMyEntry(e[0] || null)).catch(() => {});
            maybeTriggerPrizeGuide(user, setShowPrizeGuide);
          }}
        />
      )}
      {showPrizeGuide && <PrizeGuideModal onClose={() => setShowPrizeGuide(false)} />}
    </>
  );
}