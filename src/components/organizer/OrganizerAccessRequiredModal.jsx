import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";

/**
 * OrganizerAccessRequiredModal
 * Shown when a non-organizer (Fan) tries to open an Organizer-only feature.
 * Never auto-converts the account — directs the user to create a separate
 * Organizer account, or dismiss to continue as a Fan.
 */
export default function OrganizerAccessRequiredModal({ open, onClose }) {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose?.(); }}>
      <DialogContent className="max-w-sm bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-display font-black text-xl tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-primary" /> Organizer Access Only
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground leading-relaxed pt-1">
          This feature is only available for Organizer accounts. Please create a
          separate Organizer account to host events.
        </p>
        <div className="flex flex-col gap-2 pt-2">
          <Button
            className="w-full glow-lime font-display font-bold"
            onClick={() => {
              onClose?.();
              navigate("/organizer/signup");
            }}
          >
            Create Organizer Account
          </Button>
          <Button
            variant="outline"
            className="w-full border-border/50"
            onClick={() => {
              onClose?.();
              navigate("/");
            }}
          >
            Back to Home
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}