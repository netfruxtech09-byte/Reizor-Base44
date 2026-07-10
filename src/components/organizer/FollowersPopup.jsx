import { useState, useEffect } from "react";
import { X, User, ChevronLeft, ChevronRight } from "lucide-react";

const PER_PAGE = 30;

export default function FollowersPopup({ open, onClose, followers, followerCount, displayName }) {
  const [page, setPage] = useState(0);

  // Hide floating chat button when popup is open
  useEffect(() => {
    if (open) document.body.classList.add("sheet-open");
    return () => document.body.classList.remove("sheet-open");
  }, [open]);

  if (!open) return null;

  const totalPages = Math.ceil(followers.length / PER_PAGE);
  const start = page * PER_PAGE;
  const pageFollowers = followers.slice(start, start + PER_PAGE);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      <div
        className="w-full sm:max-w-md max-h-[80vh] bg-card border border-border rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: "calc(80vh - env(safe-area-inset-bottom, 0px))" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 shrink-0">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-accent" />
            <h3 className="font-display font-black text-base">
              {followerCount} {followerCount === 1 ? "Follower" : "Followers"}
            </h3>
          </div>
          <button
            onClick={() => { onClose(); setPage(0); }}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
          {pageFollowers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No followers yet.</p>
          ) : (
            pageFollowers.map((f, i) => (
              <div key={f.id || i} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/30 transition-colors">
                <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm truncate">{f.follower_name || f.follower_email}</p>
                  <p className="font-mono text-[10px] text-muted-foreground truncate">{f.follower_email}</p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border/40 shrink-0">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-mono font-bold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:pointer-events-none"
            >
              <ChevronLeft className="w-4 h-4" /> Prev
            </button>
            <span className="font-mono text-xs text-muted-foreground">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-mono font-bold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:pointer-events-none"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}