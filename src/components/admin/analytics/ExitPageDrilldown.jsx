import { useState, useMemo } from "react";
import { ArrowLeft, User, Clock, MapPin, ChevronDown, ChevronRight, AlertCircle } from "lucide-react";
import { format } from "date-fns";

function fmtDuration(ms) {
  if (!ms || ms <= 0) return null;
  const totalSec = Math.floor(ms / 1000);
  if (totalSec < 60) return `${totalSec} second${totalSec !== 1 ? "s" : ""}`;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min < 60) return sec > 0 ? `${min}m ${sec}s` : `${min} min`;
  const hr = Math.floor(min / 60);
  const remMin = min % 60;
  return `${hr}h ${remMin}m`;
}

function fmtTime(d) {
  try { return format(new Date(d), "MMM d, yyyy · h:mm a"); } catch { return "—"; }
}

function SessionCard({ session }) {
  const [open, setOpen] = useState(false);
  const hasSession = !!session.session_id;
  const duration = fmtDuration(session.durationMs);

  return (
    <div className="rounded-xl border border-border/40 bg-card/60 overflow-hidden">
      {/* Summary row */}
      <button
        className="w-full flex items-center justify-between gap-3 p-3 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="min-w-0 flex-1">
          {/* User */}
          <div className="flex items-center gap-1.5 mb-1">
            <User className="w-3 h-3 text-muted-foreground shrink-0" />
            <span className="text-xs font-medium truncate">
              {session.user_email || "Anonymous User"}
            </span>
          </div>
          {/* Journey preview */}
          <p className="text-[10px] font-mono text-muted-foreground truncate">
            {session.journey.length > 1
              ? session.journey.map((p, i) => (
                  <span key={i}>
                    {i > 0 && <span className="text-muted-foreground/40 mx-0.5">→</span>}
                    <span className={i === session.journey.length - 1 ? "text-destructive font-bold" : ""}>{p}</span>
                  </span>
                ))
              : <span className="text-destructive font-bold">{session.exitPage}</span>
            }
          </p>
        </div>
        <div className="text-right shrink-0">
          {duration && (
            <div className="flex items-center gap-1 justify-end mb-0.5">
              <Clock className="w-3 h-3 text-muted-foreground" />
              <span className="text-[10px] font-mono text-muted-foreground">{duration}</span>
            </div>
          )}
          <span className="text-[10px] font-mono text-muted-foreground/70">{session.pageCount} page{session.pageCount !== 1 ? "s" : ""}</span>
          {open ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground ml-1 inline" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground ml-1 inline" />}
        </div>
      </button>

      {/* Expanded details */}
      {open && (
        <div className="border-t border-border/30 bg-background/40 p-3 space-y-2.5 text-xs">
          {!hasSession && (
            <div className="flex items-start gap-1.5 p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <AlertCircle className="w-3.5 h-3.5 text-yellow-400 mt-0.5 shrink-0" />
              <p className="text-yellow-400/80 text-[10px] font-mono">Detailed session data not available — no session ID recorded for this view.</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            <div>
              <p className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wider mb-0.5">User</p>
              <p className="font-medium break-all">{session.user_email || "Anonymous User"}</p>
            </div>
            <div>
              <p className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wider mb-0.5">Pages Viewed</p>
              <p className="font-medium">{session.pageCount}</p>
            </div>
            <div>
              <p className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wider mb-0.5">Session Start</p>
              <p className="font-mono">{fmtTime(session.startTime)}</p>
            </div>
            <div>
              <p className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wider mb-0.5">Exit Time</p>
              <p className="font-mono">{fmtTime(session.exitTime)}</p>
            </div>
            {duration && (
              <div>
                <p className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wider mb-0.5">Session Duration</p>
                <p className="font-medium">{duration}</p>
              </div>
            )}
            <div>
              <p className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wider mb-0.5">Stage</p>
              <p className="font-medium capitalize">{session.lastStage?.replace(/_/g, " ") || "—"}</p>
            </div>
          </div>

          {/* Entry page */}
          <div>
            <p className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wider mb-1">Entry Page</p>
            <span className="px-2 py-1 rounded bg-accent/15 text-accent text-[10px] font-mono">{session.entryPage}</span>
          </div>

          {/* Full journey */}
          {session.journey.length > 1 && (
            <div>
              <p className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wider mb-1.5">Page Journey</p>
              <div className="flex flex-wrap items-center gap-1">
                {session.journey.map((p, i) => (
                  <span key={i} className="flex items-center gap-1">
                    {i > 0 && <span className="text-muted-foreground/30 text-[10px]">→</span>}
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                      i === session.journey.length - 1
                        ? "bg-destructive/20 text-destructive border border-destructive/30 font-bold"
                        : i === 0
                        ? "bg-accent/10 text-accent"
                        : "bg-muted/30 text-muted-foreground"
                    }`}>
                      {p}
                      {i === session.journey.length - 1 && <span className="ml-1 text-destructive/60">← exit</span>}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Session ID */}
          {session.session_id && (
            <p className="text-[10px] font-mono text-muted-foreground/40">Session: {session.session_id.slice(0, 16)}…</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function ExitPageDrilldown({ exitPageName, allViews, onBack }) {
  const [platformFilter, setPlatformFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");

  // Build sessions from all views
  const sessions = useMemo(() => {
    // Group by session_id when available, otherwise each view is its own "session"
    const sessionMap = {};

    allViews.forEach(v => {
      const key = v.session_id || `solo_${v.id || v.created_date}_${v.user_email || "anon"}`;
      if (!sessionMap[key]) {
        sessionMap[key] = {
          session_id: v.session_id || null,
          user_email: v.user_email || null,
          views: [],
        };
      }
      sessionMap[key].views.push(v);
    });

    return Object.values(sessionMap).map(s => {
      const sorted = [...s.views].sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
      const last = sorted[sorted.length - 1];
      const first = sorted[0];
      const durationMs = sorted.length > 1
        ? new Date(last.created_date) - new Date(first.created_date)
        : null;

      const journey = sorted.map(v => v.event_title || v.event_id || "Unknown Page");
      // Deduplicate consecutive same-page views
      const dedupedJourney = journey.filter((p, i) => i === 0 || p !== journey[i - 1]);

      return {
        session_id: s.session_id,
        user_email: s.user_email,
        exitPage: last.event_title || last.event_id || "Unknown Page",
        entryPage: first.event_title || first.event_id || "Unknown Page",
        lastStage: last.stage,
        startTime: first.created_date,
        exitTime: last.created_date,
        durationMs,
        pageCount: sorted.length,
        journey: dedupedJourney,
      };
    });
  }, [allViews]);

  // Filter to sessions that exited on this page
  const exitSessions = useMemo(() => {
    return sessions.filter(s => s.exitPage === exitPageName);
  }, [sessions, exitPageName]);

  // Apply platform + user filters (platform not tracked yet, so only user filter works)
  const filtered = useMemo(() => {
    return exitSessions.filter(s => {
      if (userFilter === "logged_in" && !s.user_email) return false;
      if (userFilter === "anonymous" && s.user_email) return false;
      return true;
    });
  }, [exitSessions, userFilter]);

  const totalDuration = filtered.reduce((s, sess) => s + (sess.durationMs || 0), 0);
  const avgDuration = filtered.length > 0 ? totalDuration / filtered.length : 0;

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border/50 shrink-0">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-bold text-sm truncate">Exit: {exitPageName}</h3>
          <p className="text-[10px] font-mono text-muted-foreground">
            {filtered.length} exit session{filtered.length !== 1 ? "s" : ""}
            {avgDuration > 0 && ` · avg ${fmtDuration(Math.round(avgDuration))}`}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 px-4 pt-3 pb-2 shrink-0 flex-wrap">
        <div className="flex rounded-lg border border-border/50 overflow-hidden text-[10px] font-mono">
          {["all", "logged_in", "anonymous"].map(f => (
            <button key={f} onClick={() => setUserFilter(f)}
              className={`px-2.5 py-1.5 font-bold transition-all ${userFilter === f ? "bg-accent text-white" : "bg-card text-muted-foreground hover:bg-muted"}`}>
              {f === "all" ? "All Users" : f === "logged_in" ? "Logged In" : "Anonymous"}
            </button>
          ))}
        </div>
      </div>

      {/* Notice about platform tracking */}
      <div className="mx-4 mb-2 p-2 rounded-lg bg-yellow-500/8 border border-yellow-500/20 flex items-start gap-1.5">
        <AlertCircle className="w-3 h-3 text-yellow-400 mt-0.5 shrink-0" />
        <p className="text-[10px] font-mono text-yellow-400/80">
          Platform/device and time-on-page tracking not yet recorded in existing data. Session duration is calculated from first → last page view timestamp.
        </p>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
        {filtered.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-muted-foreground text-sm">No exit sessions found.</p>
          </div>
        ) : (
          filtered
            .sort((a, b) => new Date(b.exitTime) - new Date(a.exitTime))
            .map((session, i) => <SessionCard key={i} session={session} />)
        )}
      </div>
    </>
  );
}