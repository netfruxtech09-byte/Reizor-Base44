import { useState, useEffect } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";

/**
 * ModerationConfirmDialog — unified confirmation for all moderation actions.
 * Destructive actions (reject / hide / delete) always require confirmation.
 * Approve confirms here too, then shows success feedback in the parent toast.
 *
 * Optional note (reject / hide) is forwarded to the uploader notification.
 */
export default function ModerationConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  confirmTone = "destructive",
  showNote = false,
  notePlaceholder = "",
  onConfirm,
  onCancel,
}) {
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) setNote("");
  }, [open]);

  if (!open) return null;

  const toneCls =
    confirmTone === "green"
      ? "bg-green-500 text-white hover:bg-green-600"
      : confirmTone === "secondary"
      ? "bg-secondary text-white hover:bg-secondary/80"
      : "bg-destructive text-white hover:bg-destructive/90";

  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{message}</AlertDialogDescription>
        </AlertDialogHeader>

        {showNote && (
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={notePlaceholder}
            className="bg-secondary border-border/50 min-h-[70px] text-sm"
          />
        )}

        <AlertDialogFooter className="flex-row justify-end gap-2 sm:justify-end">
          <AlertDialogCancel className="mt-0" onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className={toneCls}
            onClick={(e) => { e.preventDefault(); onConfirm(note); }}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}