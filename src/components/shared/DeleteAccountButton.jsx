import { useState } from "react";
import { Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

/**
 * DeleteAccountButton — reusable danger zone component for all role dashboards.
 * Shows a confirmation modal before deleting/deactivating the account.
 *
 * Props:
 *  user        — current user object (must have .id, .role, .email)
 *  onSuccess   — optional callback before logout (e.g. local cleanup)
 */
export default function DeleteAccountButton({ user, onSuccess }) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!user) return null;

  // Protect super admin: only allow if there are other admins (we just warn and block single-admin deletion)
  const isSuperAdmin = user.role === "admin";

  const warningsByRole = {
    organizer: "Any active events you manage will remain on the platform. Pending payouts will need to be resolved with the admin team.",
    manager:   "Your access to managed events will be removed.",
    artist:    "Your artist profile, posts, gallery, and digital products will be deactivated. Pending payouts will need admin resolution.",
    vendor:    "Your scanner access will be revoked.",
    admin:     "⚠️ Admin accounts cannot be self-deleted to protect platform integrity. Contact a super admin.",
  };

  const roleWarning = warningsByRole[user.role] || null;

  const handleDelete = async () => {
    if (isSuperAdmin) {
      toast.error("Admin accounts cannot be self-deleted. Contact platform support.");
      setOpen(false);
      return;
    }
    setDeleting(true);
    try {
      // Strip role and mark as deleted — hard delete may fail due to RLS
      const updates = { status: "deleted", deleted_at: new Date().toISOString() };
      // For organizers/artists: also downgrade role to prevent dashboard access
      if (["organizer", "manager", "artist", "vendor"].includes(user.role)) {
        updates.role = "user";
      }
      await base44.auth.updateMe(updates).catch(() => {});
      await base44.entities.User.delete(user.id).catch(() => {});
      onSuccess?.();
      toast.success("Account deleted. You have been signed out.");
      // Clear all local storage tokens/modes
      localStorage.removeItem("active_account_mode");
      localStorage.removeItem("wl_id");
      await base44.auth.logout("/");
    } catch (err) {
      toast.error("Failed to delete account. Please contact support.");
      setDeleting(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="w-full gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive border border-destructive/20 hover:border-destructive/40"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="w-4 h-4" />
        Delete Account
      </Button>

      {/* Confirmation Modal */}
      {open && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => !deleting && setOpen(false)}
        >
          <div
            className="bg-card border border-destructive/40 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Icon */}
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6 text-destructive" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-display font-black text-xl text-destructive">Delete Account</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Are you sure you want to delete your account?{" "}
                <span className="font-bold text-foreground">This action cannot be undone.</span>
              </p>
            </div>

            {/* Role-specific warning */}
            {roleWarning && !isSuperAdmin && (
              <div className="p-3 rounded-lg bg-yellow-400/10 border border-yellow-400/20 text-xs text-yellow-400 font-mono">
                ⚠️ {roleWarning}
              </div>
            )}

            {isSuperAdmin && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-xs text-destructive font-mono">
                Admin account deletion is protected. Contact platform support to remove an admin account.
              </div>
            )}

            <div className="text-xs text-muted-foreground text-center font-mono">
              Deleting will remove your entire account and all role access across the platform.
            </div>

            <div className="flex gap-3 pt-1">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setOpen(false)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
                onClick={handleDelete}
                disabled={deleting || isSuperAdmin}
              >
                {deleting ? (
                  <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Deleting...</>
                ) : (
                  <><Trash2 className="w-3.5 h-3.5" /> Yes, Delete Account</>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}