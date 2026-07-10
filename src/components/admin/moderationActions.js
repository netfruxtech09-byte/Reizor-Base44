import { CheckCircle2, XCircle, EyeOff, Trash2, RotateCcw } from "lucide-react";

// Status → prominent badge config (top of every moderation card)
export const STATUS_CONFIG = {
  pending_review: { label: "PENDING REVIEW", cls: "bg-yellow-400/15 text-yellow-400 border-yellow-400/40" },
  approved:       { label: "APPROVED",        cls: "bg-green-400/15 text-green-400 border-green-400/40" },
  rejected:       { label: "REJECTED",        cls: "bg-destructive/15 text-destructive border-destructive/40" },
  blocked:        { label: "HIDDEN",          cls: "bg-orange-500/15 text-orange-400 border-orange-400/40" },
};

// Action button tone → tailwind classes
export const TONE_CLS = {
  primary:     "bg-green-400/15 text-green-400 border-green-400/40 hover:bg-green-400/25",
  secondary:   "bg-muted text-foreground border-border/50 hover:bg-muted/70",
  destructive: "bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20",
};

// Tone used inside the full-screen viewer (dark backdrop)
export const TONE_CLS_DARK = {
  primary:     "bg-green-400/20 text-green-400 border-green-400/30 hover:bg-green-400/30",
  secondary:   "bg-white/10 text-white/80 border-white/20 hover:bg-white/20",
  destructive: "bg-destructive/20 text-destructive border-destructive/30 hover:bg-destructive/30",
};

// Auto-approved = approved by the automated content scan
export function isAutoApproved(item) {
  const status = item.approval_status || item.media_approval_status;
  return status === "approved" && item.moderated_by === "ai_auto_moderation";
}

// Only show actions valid for the current status — no icon-only buttons, all labeled
export function getActionsForStatus(status) {
  if (status === "pending_review") return [
    { key: "approve", label: "Approve",          icon: CheckCircle2, tone: "primary",   action: "approve" },
    { key: "reject",  label: "Reject",           icon: XCircle,       tone: "secondary", action: "reject"  },
  ];
  if (status === "approved") return [
    { key: "block",   label: "Hide / Unpublish", icon: EyeOff,        tone: "secondary", action: "block"   },
    { key: "delete",  label: "Delete Permanently", icon: Trash2,      tone: "destructive", action: "delete" },
  ];
  if (status === "rejected") return [
    { key: "approve", label: "Approve Again",    icon: RotateCcw,    tone: "primary",   action: "approve" },
    { key: "delete",  label: "Delete Permanently", icon: Trash2,      tone: "destructive", action: "delete" },
  ];
  if (status === "blocked") return [
    { key: "approve", label: "Publish Again",    icon: RotateCcw,    tone: "primary",   action: "approve" },
    { key: "delete",  label: "Delete Permanently", icon: Trash2,      tone: "destructive", action: "delete" },
  ];
  return [];
}

// Confirmation dialog config per action — destructive actions always require confirmation
export const CONFIRM_CONFIG = {
  approve: {
    title: "Approve this submission?",
    message: "This will make the content visible publicly. The uploader will be notified by email and in-app.",
    confirmLabel: "Approve",
    confirmTone: "green",
    showNote: false,
  },
  reject: {
    title: "Reject this media?",
    message: "This media will not be publicly visible.",
    confirmLabel: "Reject",
    confirmTone: "destructive",
    showNote: true,
    notePlaceholder: "Optional reason shown to the uploader...",
  },
  block: {
    title: "Hide this media?",
    message: "The media will be removed from public view but can be restored later.",
    confirmLabel: "Hide Media",
    confirmTone: "secondary",
    showNote: true,
    notePlaceholder: "Optional reason shown to the uploader...",
  },
  delete: {
    title: "Delete media permanently?",
    message: "This will permanently remove the media and cannot be undone.",
    confirmLabel: "Delete Permanently",
    confirmTone: "destructive",
    showNote: false,
  },
};

// Human-readable success toast per action
export const SUCCESS_TOAST = {
  approve: "Media approved and published.",
  reject:  "Media rejected.",
  block:   "Media hidden from public view.",
  delete:  "Media deleted permanently.",
};