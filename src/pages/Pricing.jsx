import { ArrowLeft, DollarSign, Info } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useOrganizerAccess } from "@/hooks/useOrganizerAccess";
import OrganizerAccessRequiredModal from "@/components/organizer/OrganizerAccessRequiredModal";

export default function Pricing() {
  const navigate = useNavigate();
  const { requestAccess, showModal: showOrgAccess, setShowModal: setShowOrgAccess } = useOrganizerAccess();

  return (
    <div className="min-h-screen bg-background pb-16">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-xl border-b border-border/40" data-safe-top>
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted transition-colors shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-display font-bold text-base">Pricing</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-10 space-y-8">
        {/* Title */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <DollarSign className="w-7 h-7 text-primary shrink-0" />
            <h2 className="font-display font-black text-3xl tracking-tight">Pricing</h2>
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Reizor uses fixed platform fees for events.
          </p>
        </div>

        {/* Info card */}
        <div className="p-6 rounded-2xl bg-card border border-border/50 space-y-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-accent mt-0.5 shrink-0" />
            <div className="space-y-2">
              <p className="font-display font-bold text-base">Fee Structure</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                The full fee and pricing chart is available during the event-creation process for Organizers, before an event is published.
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Platform fees are fixed and clearly displayed at every step of event setup, so there are no surprises before you go live.
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="p-5 rounded-2xl bg-primary/10 border border-primary/20 space-y-3">
          <p className="font-display font-bold text-sm">Ready to host an event?</p>
          <p className="text-xs text-muted-foreground">
            Create an event as an Organizer to view the complete pricing and fee breakdown before publishing.
          </p>
          <Button
            onClick={() => requestAccess("/organizer/create")}
            className="w-full font-display font-bold gap-2"
          >
            View Pricing — Create an Event
          </Button>
        </div>
      </div>
      <OrganizerAccessRequiredModal open={showOrgAccess} onClose={() => setShowOrgAccess(false)} />
    </div>
  );
}