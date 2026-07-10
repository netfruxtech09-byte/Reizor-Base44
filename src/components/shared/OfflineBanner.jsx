/**
 * OfflineBanner — shows a native-feeling offline/online status banner.
 * Demonstrates offline detection (native capability) to App Store reviewers.
 * Renders only when network state changes — invisible when online at load.
 */
import { useState, useEffect } from "react";
import { WifiOff, Wifi } from "lucide-react";

export default function OfflineBanner() {
  const [status, setStatus]   = useState(null); // null | 'offline' | 'back_online'
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleOffline = () => {
      setStatus("offline");
      setVisible(true);
    };
    const handleOnline = () => {
      setStatus("back_online");
      setVisible(true);
      // Auto-hide "back online" after 3s
      setTimeout(() => setVisible(false), 3000);
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online",  handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online",  handleOnline);
    };
  }, []);

  if (!visible) return null;

  const isOffline = status === "offline";

  return (
    <div
      className={`fixed top-16 left-0 right-0 z-50 flex items-center justify-center gap-2 py-2 px-4 text-xs font-mono font-bold transition-all animate-in slide-in-from-top duration-300 ${
        isOffline
          ? "bg-destructive text-white"
          : "bg-green-500 text-white"
      }`}
    >
      {isOffline ? (
        <><WifiOff className="w-3.5 h-3.5" /> You're offline — some features may be unavailable</>
      ) : (
        <><Wifi className="w-3.5 h-3.5" /> Back online!</>
      )}
    </div>
  );
}