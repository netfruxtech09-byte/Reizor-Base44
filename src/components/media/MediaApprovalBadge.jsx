/**
 * MediaApprovalBadge — shows a small pill for media approval status.
 * Used in upload flows and admin panels.
 */
export default function MediaApprovalBadge({ status, className = "" }) {
  if (!status) return null;

  const config = {
    pending_review: { label: "Pending Review", cls: "bg-yellow-400/15 text-yellow-400 border-yellow-400/30" },
    approved:       { label: "Approved",       cls: "bg-green-400/15 text-green-400 border-green-400/30" },
    rejected:       { label: "Rejected",       cls: "bg-destructive/15 text-destructive border-destructive/30" },
    blocked:        { label: "Hidden",         cls: "bg-orange-500/15 text-orange-400 border-orange-400/30" },
  };

  const cfg = config[status];
  if (!cfg) return null;

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-mono font-bold uppercase tracking-widest ${cfg.cls} ${className}`}>
      {cfg.label}
    </span>
  );
}