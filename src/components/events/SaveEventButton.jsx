import { useState } from "react";
import { Bookmark, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { useAuthGate } from "@/hooks/useAuthGate";
import { hapticSuccess, hapticLight } from "@/lib/haptics";

export default function SaveEventButton({ event, showCount = false }) {
  const [status, setStatus] = useState("idle"); // idle | saved | loading
  const [entry, setEntry] = useState(null);
  const [checked, setChecked] = useState(false);
  const [saveCount, setSaveCount] = useState(0);
  const [countLoaded, setCountLoaded] = useState(false);
  const { requireAuth } = useAuthGate();

  if (!event) return null;

  const checkSavedStatus = async () => {
    if (checked) return;
    setChecked(true);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return;
    const saved = await base44.entities.SavedEvent.filter(
      { event_id: event.id, user_email: user.email }, null, 1
    ).catch(() => []);
    if (saved[0]) { setEntry(saved[0]); setStatus("saved"); }
  };

  const toggle = async () => {
    const authed = await requireAuth("Sign in to save events to your profile.");
    if (!authed) return;
    if (!checked) await checkSavedStatus();
    const user = await base44.auth.me().catch(() => null);
    if (!user) return;

    if (entry) {
      // Optimistic: flip to idle immediately
      hapticLight();
      const prevEntry = entry;
      setEntry(null);
      setStatus("idle");
      setSaveCount(prev => Math.max(0, prev - 1));
      toast.success("Event removed from saved events");
      base44.entities.SavedEvent.delete(prevEntry.id).catch(() => {
        // Revert on failure
        setEntry(prevEntry);
        setStatus("saved");
        setSaveCount(prev => prev + 1);
        toast.error("Failed to remove — please try again");
      });
    } else {
      // Optimistic: flip to saved immediately with a temp placeholder
      hapticSuccess();
      setStatus("saved");
      setSaveCount(prev => prev + 1);
      toast.success("Event saved!");
      base44.entities.SavedEvent.create({
        event_id: event.id,
        event_title: event.title,
        user_email: user.email,
      }).then(created => {
        setEntry(created);
      }).catch(() => {
        setStatus("idle");
        setSaveCount(prev => Math.max(0, prev - 1));
        toast.error("Failed to save — please try again");
      });
    }
  };

  // Lazy-load save count on first hover/focus
  const loadCount = async () => {
    if (countLoaded) return;
    setCountLoaded(true);
    const saved = await base44.entities.SavedEvent.filter(
      { event_id: event.id }, null, 5000
    ).catch(() => []);
    setSaveCount(saved.length);
  };

  const countDisplay = showCount && saveCount > 0 ? (
    <span className="text-xs font-mono font-bold text-white/70 ml-1" style={{ minWidth: "1.5ch" }}>
      {saveCount}
    </span>
  ) : null;

  return (
    <div className="flex items-center gap-0.5">
      <button
        onClick={toggle}
        onMouseEnter={() => { checkSavedStatus(); loadCount(); }}
        onFocus={() => { checkSavedStatus(); loadCount(); }}
        disabled={status === "loading"}
        title={status === "saved" ? "Remove from saved" : "Save event"}
        className={`w-11 h-11 rounded-full flex items-center justify-center shadow-lg transition-all touch-manipulation ${
          status === "saved"
            ? "bg-accent/90 text-white"
            : "bg-black/50 backdrop-blur-sm text-white/80 hover:bg-black/70"
        }`}
        style={{ WebkitTapHighlightColor: "transparent" }}
      >
        {status === "loading" ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Bookmark className={`w-5 h-5 transition-all ${status === "saved" ? "fill-white" : ""}`} />
        )}
      </button>
      {countDisplay}
    </div>
  );
}