import { useEffect, useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";

const POLL_INTERVAL_MS = 10000;
const MAX_POLL_MINUTES = 15;

export default function MuxStatusBadge({ post, onStatusUpdate }) {
  const [status, setStatus] = useState(post?.mux_status || null);
  const [error, setError] = useState(post?.mux_error_message || null);
  const [checking, setChecking] = useState(false);
  const pollRef = useRef(null);
  const startTimeRef = useRef(null);

  useEffect(() => {
    if (!post?.mux_asset_id) return;
    if (post.mux_status === "ready" || post.mux_status === "errored") {
      setStatus(post.mux_status);
      setError(post.mux_error_message || null);
      return;
    }

    // Start polling for "preparing" status
    startTimeRef.current = Date.now();
    const poll = async () => {
      const maxTime = MAX_POLL_MINUTES * 60 * 1000;
      if (Date.now() - startTimeRef.current > maxTime) {
        setStatus("timeout");
        return;
      }

      try {
        const res = await base44.functions.invoke("checkMuxAssetStatus", {
          mux_asset_id: post.mux_asset_id,
          media_post_id: post.id,
        });
        const s = res.data?.mux_status;
        setStatus(s);
        setError(res.data?.mux_error_message || null);
        if (onStatusUpdate) onStatusUpdate(res.data);

        if (s === "ready" || s === "errored") return;
        pollRef.current = setTimeout(poll, POLL_INTERVAL_MS);
      } catch {
        // Network error — retry on next interval
        pollRef.current = setTimeout(poll, POLL_INTERVAL_MS);
      }
    };

    pollRef.current = setTimeout(poll, 5000);

    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [post?.id, post?.mux_asset_id]);

  const handleRetry = async () => {
    if (!post?.media_url) return;
    setChecking(true);
    try {
      const res = await base44.functions.invoke("createMuxAsset", {
        video_url: post.media_url,
        media_post_id: post.id,
      });
      setStatus(res.data?.mux_status);
      setError(null);
      startTimeRef.current = Date.now();
      if (res.data?.mux_status === "preparing") {
        if (pollRef.current) clearTimeout(pollRef.current);
        // Restart polling
        const poll = async () => {
          const maxTime = MAX_POLL_MINUTES * 60 * 1000;
          if (Date.now() - startTimeRef.current > maxTime) {
            setStatus("timeout");
            return;
          }
          try {
            const r = await base44.functions.invoke("checkMuxAssetStatus", {
              mux_asset_id: res.data.mux_asset_id,
              media_post_id: post.id,
            });
            setStatus(r.data?.mux_status);
            setError(r.data?.mux_error_message || null);
            if (onStatusUpdate) onStatusUpdate(r.data);
            if (r.data?.mux_status === "ready" || r.data?.mux_status === "errored") return;
            pollRef.current = setTimeout(poll, POLL_INTERVAL_MS);
          } catch {
            pollRef.current = setTimeout(poll, POLL_INTERVAL_MS);
          }
        };
        pollRef.current = setTimeout(poll, POLL_INTERVAL_MS);
      }
      if (onStatusUpdate) onStatusUpdate(res.data);
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "Retry failed");
    } finally {
      setChecking(false);
    }
  };

  if (!status) return null;

  const config = {
    preparing: { icon: Loader2, color: "text-yellow-400", bg: "bg-yellow-400/10", border: "border-yellow-400/20", label: "Video is encoding…", spin: true },
    ready: { icon: CheckCircle2, color: "text-green-400", bg: "bg-green-400/10", border: "border-green-400/20", label: "Ready", spin: false },
    errored: { icon: AlertTriangle, color: "text-red-400", bg: "bg-red-400/10", border: "border-red-400/20", label: "Processing failed", spin: false },
    timeout: { icon: AlertTriangle, color: "text-orange-400", bg: "bg-orange-400/10", border: "border-orange-400/20", label: "Processing timeout", spin: false },
    idle: { icon: Loader2, color: "text-slate-400", bg: "bg-slate-400/10", border: "border-slate-400/20", label: "Encoding queued…", spin: true },
  }[status] || { icon: Loader2, color: "text-slate-400", bg: "bg-slate-400/10", border: "border-slate-400/20", label: status, spin: true };

  const Icon = config.icon;

  return (
    <div className={`flex items-center gap-2 px-2.5 py-1 rounded text-xs font-mono ${config.color} ${config.bg} border ${config.border}`}>
      <Icon className={`w-3 h-3 ${config.spin ? "animate-spin" : ""}`} />
      <span>{config.label}</span>
      {(status === "errored" || status === "timeout") && (
        <button
          onClick={handleRetry}
          disabled={checking}
          className="ml-1 p-0.5 rounded hover:bg-white/10 transition-colors disabled:opacity-50"
          title="Retry video encoding"
        >
          <RefreshCw className={`w-3 h-3 ${checking ? "animate-spin" : ""}`} />
        </button>
      )}
      {error && (status === "errored" || status === "timeout") && (
        <span className="text-[10px] opacity-70 truncate max-w-[120px]">{error}</span>
      )}
    </div>
  );
}