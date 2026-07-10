import { Loader2, ImageIcon, Video, ZoomIn, Bot } from "lucide-react";
import { format } from "date-fns";
import {
  STATUS_CONFIG,
  TONE_CLS,
  isAutoApproved,
  getActionsForStatus,
} from "@/components/admin/moderationActions";

/**
 * ModerationCard — replaces the old icon-only action row with clear, labeled,
 * status-aware buttons. Shows a prominent status badge, moderation metadata,
 * and a responsive layout (stacked on desktop, 2-per-row on mobile).
 *
 * Only actions valid for the item's current status are shown.
 * No action fires on card open/click — only when an explicit button is pressed.
 */
export default function ModerationCard({ item, onAction, onReview, moderatingId }) {
  const status = item.approval_status || item.media_approval_status || "pending_review";
  const isModerating = moderatingId === item.id;
  const auto = isAutoApproved(item);

  const previewUrl = item.url || item.media_url || item.media_urls?.[0] || item.cover_url;
  const mediaType = item.type || item.media_type || item.media_types?.[0] || "image";
  const isVideo = mediaType === "video";
  const title = item.title || item.caption || item.artist_name || item.organizer_name || "Untitled";
  const uploaderName =
    item.uploaded_by_name || item.author_name || item.artist_name || item.organizer_name || "—";

  const statusCfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending_review;
  const actions = getActionsForStatus(status);

  const statusBorder =
    status === "pending_review" ? "border-yellow-400/40"
    : status === "approved" ? "border-green-400/25"
    : status === "blocked" ? "border-orange-400/30"
    : "border-destructive/30";

  const handleAction = (a) => {
    if (isModerating) return;
    onAction(item, a.action);
  };

  const renderButton = (a, full = false) => {
    const Icon = a.icon;
    return (
      <button
        key={a.key}
        onClick={() => handleAction(a)}
        disabled={isModerating}
        className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-bold border transition-all min-h-[44px] disabled:opacity-50 disabled:pointer-events-none touch-manipulation active:scale-95 ${TONE_CLS[a.tone]} ${full ? "w-full" : ""}`}
      >
        <Icon className="w-4 h-4 shrink-0" />
        <span className="truncate">{a.label}</span>
      </button>
    );
  };

  // "View" button — pink (primary) tone, visible on both desktop and mobile.
  // `full` controls full-width (desktop stack + mobile bottom row) vs grid cell (mobile top row).
  const renderViewBtn = (full = false) => (
    <button
      onClick={onReview}
      disabled={isModerating}
      className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-bold border transition-all min-h-[44px] disabled:opacity-50 disabled:pointer-events-none touch-manipulation active:scale-95 bg-primary/15 text-primary border-primary/40 hover:bg-primary/25 ${full ? "w-full" : ""}`}
    >
      <ZoomIn className="w-4 h-4 shrink-0" />
      <span className="truncate">View</span>
    </button>
  );

  return (
    <div className={`flex flex-col rounded-2xl bg-card border ${statusBorder} overflow-hidden shadow-sm hover:shadow-md transition-shadow`}>

      {/* ── Status badge bar (top of card) ── */}
      <div className={`flex items-center gap-1.5 px-3 py-2 border-b border-border/30 ${statusCfg.cls}`}>
        {auto && <Bot className="w-3.5 h-3.5 shrink-0" />}
        <span className="text-[10px] font-mono font-black tracking-widest">
          {auto ? "AUTO-APPROVED" : statusCfg.label}
        </span>
      </div>

      {/* ── Media preview ── */}
      <div className="relative w-full aspect-video bg-muted shrink-0 overflow-hidden">
        {previewUrl ? (
          isVideo ? (
            <div className="relative w-full h-full flex items-center justify-center cursor-pointer group" onClick={onReview}>
              {item.thumbnail_url && (
                <img src={item.thumbnail_url} alt={title} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
              )}
              <div className="relative w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                <Video className="w-5 h-5 text-white" />
              </div>
            </div>
          ) : (
            <img src={previewUrl} alt={title} className="w-full h-full object-cover cursor-pointer" loading="lazy" onClick={onReview} />
          )
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="w-8 h-8 text-muted-foreground/30" />
          </div>
        )}

        <div className="absolute top-2 left-2 flex items-center gap-1.5 pointer-events-none">
          <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md ${isVideo ? "bg-purple-500/80 text-white" : "bg-black/50 text-white/90"}`}>
            {isVideo ? "VIDEO" : "IMAGE"}
          </span>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-col flex-1 p-3 gap-2">
        <p className="font-display font-bold text-sm leading-tight line-clamp-2">{title}</p>

        {/* Moderation metadata */}
        <div className="space-y-0.5 text-[10px] font-mono text-muted-foreground">
          <p>Submitted by: <span className="text-foreground/80">{uploaderName}</span></p>
          {item.created_date && (
            <p>Submitted: {format(new Date(item.created_date), "MMM dd, yyyy")}</p>
          )}
          {auto && item.moderation_note && (
            <p className="text-accent">🤖 {item.moderation_note}</p>
          )}
          {!auto && item.moderated_by && item.moderated_at && (
            <p>Reviewed by: <span className="text-foreground/80">{item.moderated_by}</span> · {format(new Date(item.moderated_at), "MMM dd, yyyy")}</p>
          )}
        </div>

        {/* ── Actions ── */}
        <div className="mt-auto pt-1 flex flex-col gap-2">
          {isModerating ? (
            <div className="flex items-center justify-center py-3">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Desktop: stacked, full-width labeled buttons (clear hierarchy) */}
              <div className="hidden sm:flex flex-col gap-2">
                {actions.map((a) => renderButton(a, true))}
                {renderViewBtn(true)}
              </div>

              {/* Mobile: when a Delete action exists, it takes the full-width bottom row
                  and View moves up into the 2-per-row grid alongside the other actions.
                  When there's no Delete, View stays full-width at the bottom. */}
              <div className="flex sm:hidden flex-col gap-2">
                {(() => {
                  const deleteAction = actions.find(a => a.action === "delete");
                  if (deleteAction) {
                    const topActions = actions.filter(a => a.action !== "delete");
                    const topCells = [...topActions, { view: true }];
                    return (
                      <>
                        <div className={`grid gap-2 ${topCells.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                          {topActions.map((a) => renderButton(a))}
                          {renderViewBtn(false)}
                        </div>
                        {renderButton(deleteAction, true)}
                      </>
                    );
                  }
                  return (
                    <>
                      <div className={`grid gap-2 ${actions.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                        {actions.map((a) => renderButton(a))}
                      </div>
                      {renderViewBtn(true)}
                    </>
                  );
                })()}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}